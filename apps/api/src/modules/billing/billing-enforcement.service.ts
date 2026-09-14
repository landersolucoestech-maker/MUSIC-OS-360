import { Inject, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE, ADMIN_DATA_SOURCE } from '../../database/database.module';
import { AuditService } from '../../core/audit/audit.service';

export type TenantBillingStatus =
  | 'active'
  | 'trial'
  | 'payment_grace'
  | 'read_only'
  | 'suspended'
  | 'cancelled';

export interface TenantBillingState {
  id: string;
  tenant_id: string;
  status: TenantBillingStatus;
  last_payment_at: Date | null;
  next_payment_at: Date | null;
  grace_until: Date | null;
  suspended_at: Date | null;
  manual_override: boolean;
  manual_override_reason: string | null;
  manual_override_until: Date | null;
  created_at: Date;
  updated_at: Date;
  /**
   * P0-A-R5: set ONLY when `status` actually transitions (never bumped by an
   * idempotent re-write of the same status) — see `auditStateChange`. This is
   * the safe discriminator for external dedup keys; `updated_at` is NOT,
   * because several writers (including `updateAdminTenant`) legitimately
   * touch it without a real status change.
   */
  status_changed_at: Date;
}

export interface BillingEnforcementSettings {
  grace_period_days: number;
  read_only_after_days: number;
  suspend_after_days: number;
  billing_warning_emails: boolean;
  billing_retry_emails: boolean;
  max_payment_attempts: number;
  manual_override_allowed: boolean;
  manual_override_max_days: number;
}

const DEFAULT_SETTINGS: BillingEnforcementSettings = {
  grace_period_days: 3,
  read_only_after_days: 4,
  suspend_after_days: 15,
  billing_warning_emails: true,
  billing_retry_emails: true,
  max_payment_attempts: 4,
  manual_override_allowed: true,
  manual_override_max_days: 30,
};

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeSettings(value: unknown): BillingEnforcementSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    grace_period_days: Number(raw['grace_period_days'] ?? DEFAULT_SETTINGS.grace_period_days),
    read_only_after_days: Number(raw['read_only_after_days'] ?? DEFAULT_SETTINGS.read_only_after_days),
    suspend_after_days: Number(raw['suspend_after_days'] ?? DEFAULT_SETTINGS.suspend_after_days),
    billing_warning_emails: raw['billing_warning_emails'] !== false,
    billing_retry_emails: raw['billing_retry_emails'] !== false,
    max_payment_attempts: Number(raw['max_payment_attempts'] ?? DEFAULT_SETTINGS.max_payment_attempts),
    manual_override_allowed: raw['manual_override_allowed'] !== false,
    manual_override_max_days: Number(raw['manual_override_max_days'] ?? DEFAULT_SETTINGS.manual_override_max_days),
  };
}

@Injectable()
export class BillingEnforcementService {
  private readonly logger = new Logger(BillingEnforcementService.name);
  /** find-95fe7b59: staleness window for reclaiming a stuck 'processing' payment_events row — see `recordWebhookProcessed`. */
  private static readonly STALE_PROCESSING_MS = 5 * 60 * 1000;

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    private readonly audit: AuditService,
    @Inject(ADMIN_DATA_SOURCE) @Optional() private readonly adminDs?: DataSource | null,
  ) {}

  private assertDb(): DataSource {
    if (!this.ds) throw new ServiceUnavailableException('Billing enforcement persistence unavailable');
    return this.ds;
  }

  /**
   * Cross-tenant enumeration for background jobs (e.g. DunningService) that
   * need to sweep every tenant currently in a restricted billing state —
   * mirrors the admin-connection pattern already used by
   * ContractExpiryScheduler/InvoiceOverdueScheduler for the same reason: a
   * per-request `this.ds` is tenant-scoped under RLS and cannot see other
   * tenants' rows, so this one query needs the bypass-RLS admin connection.
   * Per-row processing must still go through `getState()`/`runInTenantContext`
   * so escalation and any further reads/writes are correctly tenant-scoped.
   */
  async listTenantIdsRequiringDunningAttention(): Promise<string[]> {
    const enumDs = this.adminDs ?? this.ds;
    if (!enumDs) return [];
    const rows = await enumDs.query(
      `SELECT tenant_id FROM tenant_billing_state WHERE status IN ('payment_grace','read_only','suspended')`,
    ) as Array<{ tenant_id: string }>;
    return rows.map((r) => r.tenant_id);
  }

  async getSettings(): Promise<BillingEnforcementSettings> {
    if (!this.ds) return DEFAULT_SETTINGS;
    const rows = await this.ds.query(
      `SELECT value FROM billing_settings WHERE key = $1 LIMIT 1`,
      ['default_enforcement'],
    ) as Array<{ value: unknown }>;
    return normalizeSettings(rows[0]?.value);
  }

  async ensureState(tenantId: string): Promise<TenantBillingState> {
    const ds = this.assertDb();
    await ds.query(
      `INSERT INTO tenant_billing_state (tenant_id, status)
       VALUES ($1, 'trial')
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId],
    );
    return this.getState(tenantId) as Promise<TenantBillingState>;
  }

  /**
   * P0-A-R1: pure read, no side effects — the row exactly as persisted, never
   * triggers escalation. Every mutating method below uses this (not
   * `getState`) for its `before` audit snapshot: fetching `before` via
   * `getState` re-entered `applyOverrideAndEscalation`, which for a tenant
   * already past its suspend threshold calls `suspendTenant` again, whose own
   * `before` fetch repeated the exact same unresolved condition — infinite
   * recursion with no base case. A snapshot for an audit "before" must be the
   * literal current row, not "the row after re-running escalation on itself".
   */
  private async readStateRaw(tenantId: string, manager?: EntityManager): Promise<TenantBillingState | null> {
    const runner = manager ?? this.ds;
    if (!runner) return null;
    const rows = await runner.query(
      `SELECT * FROM tenant_billing_state WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    ) as TenantBillingState[];
    return rows[0] ?? null;
  }

  /**
   * find-d45d822d: CQS — pure read, zero UPDATE/INSERT, directly or
   * transitively. `readStateRaw` fixed the getState<->suspendTenant
   * recursion, but until this change `getState()` still called
   * `applyOverrideAndEscalation` (which issues UPDATEs) on every call — a
   * read that silently writes on every authenticated request. Any caller
   * that wants the escalated/live status (and is willing to trigger the
   * write that comes with computing it) must call
   * `getStateWithEscalation()` explicitly instead.
   */
  async getState(tenantId: string): Promise<TenantBillingState | null> {
    return this.readStateRaw(tenantId);
  }

  /**
   * find-d45d822d: the escalating counterpart of `getState()` — reads the
   * row and then applies any due `payment_grace -> read_only -> suspended`
   * transition (or manual-override expiry) as a side effect, exactly what
   * `getState()` used to do implicitly. Call this only where a transition is
   * actually intended: `BillingEnforcementGuard` (every enforced request
   * must see/settle the live status) and `BillingService.getSubscription`/
   * `getUsage` (the `/billing` routes are on the guard's always-allowed
   * list, so this is their only escalation trigger point for a tenant who
   * exclusively visits the billing page).
   */
  async getStateWithEscalation(tenantId: string): Promise<TenantBillingState | null> {
    const state = await this.readStateRaw(tenantId);
    if (!state) return null;
    return this.applyOverrideAndEscalation(state);
  }

  async findTenantIdByStripe(params: {
    customerId?: string | null;
    subscriptionId?: string | null;
    tenantId?: string | null;
  }): Promise<string | null> {
    if (params.tenantId) return params.tenantId;
    if (!this.ds) return null;
    const rows = await this.ds.query(
      `SELECT tenant_id
         FROM billing_subscriptions
        WHERE ($1::varchar IS NOT NULL AND stripe_customer_id = $1)
           OR ($2::varchar IS NOT NULL AND (stripe_subscription_id = $2 OR stripe_sub_id = $2))
        LIMIT 1`,
      [params.customerId ?? null, params.subscriptionId ?? null],
    ) as Array<{ tenant_id: string | null }>;
    return rows[0]?.tenant_id ?? null;
  }

  /**
   * Claims the right to process a Stripe event, atomically.
   *
   * A row existing in `payment_events` used to mean "seen" and "safely
   * applied" were the same fact — processed_at was stamped at insert time,
   * before the caller had actually processed anything. A transient failure
   * (not a business rejection) left a "seen" row behind with nothing
   * actually applied; Stripe's retry of the same event.id then always hit
   * the dedup path and the event's effect was permanently lost.
   *
   * Now: INSERT claims a fresh event (status='processing'). If another
   * delivery already holds/held that event.id, a row whose last attempt
   * genuinely FAILED can be reclaimed — atomically, via the same single
   * UPDATE statement (Postgres row-level locking serializes two concurrent
   * reclaim attempts; only one UPDATE affects a row).
   *
   * find-95fe7b59: a row can ALSO get stuck at 'processing' forever with no
   * `failed` transition at all — a process crash/kill/connection-loss
   * between the INSERT above and `markWebhookProcessed`/`markWebhookFailed`
   * leaves it exactly there, since nothing threw to route it to 'failed'.
   * The old `WHERE status = 'failed'` guard never matched that row, so
   * every one of Stripe's retries of the same event.id hit `ON CONFLICT DO
   * NOTHING` and permanently no-op'd — the event's effect was lost forever,
   * silently. A 'processing' row is now also reclaimable once it has sat
   * untouched past `STALE_PROCESSING_MS` — long enough that no legitimate
   * in-flight attempt is still running, short enough to recover well within
   * Stripe's retry window. A reclaim resets the claim clock (`created_at =
   * now()`) so the fresh attempt gets its own full staleness window instead
   * of being immediately re-reclaimable by the very next retry. A
   * 'processing' row younger than the window, or a 'processed' row, is
   * never reclaimed — that's a real in-flight duplicate or an
   * already-applied event, not a lost one.
   *
   * ponytail: fixed threshold + reusing `created_at` as the claim clock (no
   * dedicated `claimed_at` column, no per-environment tuning) — upgrade to
   * a dedicated `claimed_at` column via migration if real processing
   * legitimately needs longer than `STALE_PROCESSING_MS`, or if `created_at`
   * needs to keep meaning "first ever seen" for auditing. Not added here:
   * `database/migrations/index.ts` already has unrelated in-flight changes
   * from a concurrent workstream.
   */
  async recordWebhookProcessed(input: {
    tenantId: string | null;
    stripeEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<'inserted' | 'duplicate'> {
    const ds = this.assertDb();
    const inserted = await ds.query(
      `INSERT INTO payment_events (stripe_event_id, tenant_id, event_type, payload, status)
       VALUES ($1, $2, $3, $4::jsonb, 'processing')
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING id`,
      [
        input.stripeEventId,
        input.tenantId,
        input.eventType,
        JSON.stringify(input.payload),
      ],
    ) as Array<{ id: string }>;
    if (inserted.length > 0) return 'inserted';

    const reclaimed = await ds.query(
      `UPDATE payment_events
          SET status = 'processing', tenant_id = COALESCE(tenant_id, $2), payload = $3::jsonb, created_at = now()
        WHERE stripe_event_id = $1
          AND (status = 'failed' OR (status = 'processing' AND created_at < now() - ($4 || ' milliseconds')::interval))
        RETURNING id`,
      [input.stripeEventId, input.tenantId, JSON.stringify(input.payload), BillingEnforcementService.STALE_PROCESSING_MS],
    ) as Array<{ id: string }>;
    return reclaimed.length > 0 ? 'inserted' : 'duplicate';
  }

  /** Marks a claimed event as genuinely applied — the only state a retry treats as a true duplicate. */
  async markWebhookProcessed(stripeEventId: string): Promise<void> {
    const ds = this.assertDb();
    await ds.query(
      `UPDATE payment_events SET status = 'processed', processed_at = now() WHERE stripe_event_id = $1`,
      [stripeEventId],
    );
  }

  /** Marks a claimed event as failed — a later delivery of the same event.id can reclaim and retry it. */
  async markWebhookFailed(stripeEventId: string): Promise<void> {
    const ds = this.assertDb();
    await ds.query(
      `UPDATE payment_events SET status = 'failed' WHERE stripe_event_id = $1`,
      [stripeEventId],
    );
  }

  /**
   * find-329e1db7 (concurrency/ordering): eventCreatedAtSec, when provided,
   * anchors an atomic WHERE guard on the tenant_billing_state upsert itself
   * (mirroring find-602e8654's billing_subscriptions guard) so two
   * concurrently-delivered invoice webhooks for the same tenant can't race
   * past each other -- the write for the chronologically OLDER Stripe event
   * is rejected at the SQL level even if both requests read the same
   * pre-write state. Callers that don't pass it (manual admin actions,
   * subscription-status transitions that already have their own upstream
   * `applied` guard via upsertStripeSubscription) keep the previous
   * unconditional-apply behavior. Returns null when the write was rejected
   * as stale -- callers must not run further side effects (websocket
   * notifications, other table writes) in that case.
   */
  async startPaymentGrace(tenantId: string, reason: string, now = new Date(), manager?: EntityManager, eventCreatedAtSec?: number): Promise<TenantBillingState | null> {
    const ds = manager ?? this.assertDb();
    const settings = await this.getSettings();
    const before = await this.readStateRaw(tenantId, manager);
    // Stripe fires a new event.id per retry attempt on the same failed invoice
    // (Smart Retries), so payment_events dedup (a literal-replay guard) does
    // not intercept these. grace_until is the single anchor
    // applyOverrideAndEscalation uses for the whole
    // payment_grace -> read_only -> suspended timeline, so a tenant already
    // inside that window must keep its original deadline — only a fresh
    // entry into payment_grace starts a new clock.
    const alreadyInGrace = before?.status === 'payment_grace' || before?.status === 'read_only';
    const graceUntil = alreadyInGrace && before?.grace_until
      ? new Date(before.grace_until)
      : addDays(now, settings.grace_period_days);

    await ds.query(
      `UPDATE billing_subscriptions
          SET status = 'past_due',
              grace_until = $2,
              updated_at = now()
        WHERE tenant_id = $1`,
      [tenantId, graceUntil],
    );
    const rows = await ds.query(
      `INSERT INTO tenant_billing_state (tenant_id, status, grace_until)
       VALUES ($1, 'payment_grace', $2)
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         status = CASE
           WHEN tenant_billing_state.manual_override = true
            AND tenant_billing_state.manual_override_until IS NOT NULL
            AND tenant_billing_state.manual_override_until > now()
           THEN tenant_billing_state.status
           ELSE 'payment_grace'
         END,
         grace_until = $2,
         updated_at = now()
       WHERE $3::bigint IS NULL
          OR tenant_billing_state.status_changed_at IS NULL
          OR to_timestamp($3) >= tenant_billing_state.status_changed_at
       RETURNING *`,
      [tenantId, graceUntil, eventCreatedAtSec ?? null],
    ) as TenantBillingState[];
    const after = rows[0];
    if (!after) return null;
    await this.auditStateChange('billing.grace_started', tenantId, before, after, reason, manager);
    return after;
  }

  async activateTenant(tenantId: string, reason: string, now = new Date(), manager?: EntityManager, eventCreatedAtSec?: number): Promise<TenantBillingState | null> {
    const ds = manager ?? this.assertDb();
    const before = await this.readStateRaw(tenantId, manager);
    await ds.query(
      `UPDATE billing_subscriptions
          SET status = 'active',
              grace_until = NULL,
              suspended_at = NULL,
              resumed_at = $2,
              updated_at = now()
        WHERE tenant_id = $1`,
      [tenantId, now],
    );
    const rows = await ds.query(
      `INSERT INTO tenant_billing_state (
         tenant_id, status, last_payment_at, grace_until, suspended_at, manual_override,
         manual_override_reason, manual_override_until
       )
       VALUES ($1, 'active', $2, NULL, NULL, false, NULL, NULL)
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         status = 'active',
         last_payment_at = $2,
         grace_until = NULL,
         suspended_at = NULL,
         manual_override = false,
         manual_override_reason = NULL,
         manual_override_until = NULL,
         updated_at = now()
       WHERE $3::bigint IS NULL
          OR tenant_billing_state.status_changed_at IS NULL
          OR to_timestamp($3) >= tenant_billing_state.status_changed_at
       RETURNING *`,
      [tenantId, now, eventCreatedAtSec ?? null],
    ) as TenantBillingState[];
    const after = rows[0];
    if (!after) return null;
    await this.auditStateChange('tenant.reactivated', tenantId, before, after, reason, manager);
    return after;
  }

  async cancelTenant(tenantId: string, reason: string, manager?: EntityManager): Promise<TenantBillingState> {
    const before = await this.readStateRaw(tenantId, manager);
    const rows = await (manager ?? this.assertDb()).query(
      `INSERT INTO tenant_billing_state (tenant_id, status)
       VALUES ($1, 'cancelled')
       ON CONFLICT (tenant_id)
       DO UPDATE SET status = 'cancelled', updated_at = now()
       RETURNING *`,
      [tenantId],
    ) as TenantBillingState[];
    const after = rows[0];
    await this.auditStateChange('subscription.cancelled', tenantId, before, after, reason, manager);
    return after;
  }

  async suspendTenant(tenantId: string, reason: string, now = new Date(), manager?: EntityManager): Promise<TenantBillingState> {
    const ds = manager ?? this.assertDb();
    const before = await this.readStateRaw(tenantId, manager);
    await ds.query(
      `UPDATE billing_subscriptions
          SET suspended_at = COALESCE(suspended_at, $2),
              updated_at = now()
        WHERE tenant_id = $1`,
      [tenantId, now],
    );
    const rows = await ds.query(
      `INSERT INTO tenant_billing_state (tenant_id, status, suspended_at)
       VALUES ($1, 'suspended', $2)
       ON CONFLICT (tenant_id)
       DO UPDATE SET status = 'suspended',
                     suspended_at = COALESCE(tenant_billing_state.suspended_at, $2),
                     updated_at = now()
       RETURNING *`,
      [tenantId, now],
    ) as TenantBillingState[];
    const after = rows[0];
    await this.auditStateChange('tenant.suspended', tenantId, before, after, reason, manager);
    return after;
  }

  async applyManualOverride(input: {
    tenantId: string;
    status: TenantBillingStatus;
    reason: string;
    until: Date;
    userId?: string | null;
    ip?: string | null;
  }): Promise<TenantBillingState> {
    const settings = await this.getSettings();
    if (!settings.manual_override_allowed) {
      throw new ServiceUnavailableException('Manual billing override is disabled');
    }
    const maxUntil = addDays(new Date(), settings.manual_override_max_days);
    const until = input.until > maxUntil ? maxUntil : input.until;
    const before = await this.readStateRaw(input.tenantId);
    const rows = await this.assertDb().query(
      `INSERT INTO tenant_billing_state (
         tenant_id, status, manual_override, manual_override_reason, manual_override_until
       )
       VALUES ($1, $2, true, $3, $4)
       ON CONFLICT (tenant_id)
       DO UPDATE SET status = $2,
                     manual_override = true,
                     manual_override_reason = $3,
                     manual_override_until = $4,
                     updated_at = now()
       RETURNING *`,
      [input.tenantId, input.status, input.reason, until],
    ) as TenantBillingState[];
    const after = rows[0];
    if (!before || before.status !== after.status) {
      const changed = await this.assertDb().query(
        `UPDATE tenant_billing_state SET status_changed_at = now() WHERE tenant_id = $1 RETURNING status_changed_at`,
        [input.tenantId],
      ) as Array<{ status_changed_at: Date }>;
      if (changed[0]) after.status_changed_at = changed[0].status_changed_at;
    }
    await this.audit.log({
      tenantId: input.tenantId,
      userId: input.userId ?? 'billing:system',
      actorRole: input.userId ? 'admin' : 'system',
      action: 'billing.override_enabled',
      entity: 'billing',
      entityId: input.tenantId,
      before,
      after,
      ip: input.ip ?? null,
    });
    return after;
  }

  async removeManualOverride(tenantId: string, reason: string, userId?: string | null): Promise<TenantBillingState> {
    const before = await this.readStateRaw(tenantId);
    const rows = await this.assertDb().query(
      `UPDATE tenant_billing_state
          SET manual_override = false,
              manual_override_reason = NULL,
              manual_override_until = NULL,
              updated_at = now()
        WHERE tenant_id = $1
        RETURNING *`,
      [tenantId],
    ) as TenantBillingState[];
    const after = rows[0] ?? await this.ensureState(tenantId);
    await this.audit.log({
      tenantId,
      userId: userId ?? 'billing:system',
      actorRole: userId ? 'admin' : 'system',
      action: 'billing.override_disabled',
      entity: 'billing',
      entityId: tenantId,
      before,
      after,
      metadata: { reason },
    } as any);
    return this.applyOverrideAndEscalation(after);
  }

  async applyOverrideAndEscalation(state: TenantBillingState, now = new Date()): Promise<TenantBillingState> {
    if (state.manual_override && state.manual_override_until && new Date(state.manual_override_until) > now) {
      return state;
    }
    if (state.status !== 'payment_grace' && state.status !== 'read_only') {
      if (state.manual_override && state.manual_override_until && new Date(state.manual_override_until) <= now) {
        return this.removeManualOverride(state.tenant_id, 'manual override expired');
      }
      return state;
    }

    const settings = await this.getSettings();
    const graceUntil = state.grace_until ? new Date(state.grace_until) : null;
    if (!graceUntil) return state;

    const suspendAt = addDays(graceUntil, Math.max(0, settings.suspend_after_days - settings.grace_period_days));
    if (now >= suspendAt) {
      return this.suspendTenant(state.tenant_id, 'billing grace and read-only windows expired', now);
    }
    if (now > graceUntil && state.status !== 'read_only') {
      const before = state;
      // find-c64da2b1: optimistic guard — WHERE status = <the status this
      // decision was actually computed from>, matching the same
      // read-your-write safety every other transition here gets for free
      // from its INSERT ... ON CONFLICT DO UPDATE upsert. This one is a
      // plain UPDATE (the row is known to already exist on this path), so
      // without the guard a concurrent writer that already moved the tenant
      // off `before.status` (e.g. a webhook's activateTenant/suspendTenant
      // landing between our read and this write) would be silently
      // stomped back to 'read_only' — a lost update.
      const rows = await this.assertDb().query(
        `UPDATE tenant_billing_state
            SET status = 'read_only', updated_at = now()
          WHERE tenant_id = $1 AND status = $2
          RETURNING *`,
        [state.tenant_id, before.status],
      ) as TenantBillingState[];
      if (rows.length === 0) {
        // Lost the race — some other writer already changed this tenant's
        // status. Report the actual current row, never a blind overwrite.
        return (await this.readStateRaw(state.tenant_id)) ?? before;
      }
      const after = rows[0];
      await this.auditStateChange('billing.read_only', state.tenant_id, before, after, 'payment grace expired');
      return after;
    }
    return state;
  }

  /**
   * P0-A-R5: bumps `status_changed_at` exactly once per genuine status
   * transition, centralized here since every status-mutating method already
   * calls this before returning. `updated_at` is touched by multiple writers
   * (including `updateAdminTenant`'s admin-panel path) even without a real
   * status change, so it is not a safe dedup discriminator for consumers
   * like `DunningService` — `status_changed_at` is.
   */
  /**
   * P0-A-R6: `manager`, when supplied by a caller that opened its own
   * transaction (e.g. `BillingService.updateAdminTenant`), scopes the
   * `status_changed_at` write to that same transaction so it rolls back
   * with everything else. `this.audit.log(...)` below deliberately does
   * NOT receive `manager` — `AuditService` resolves its repository once
   * from its own injected `DataSource` and has no external-manager entry
   * point, so the audit row is always written on a separate connection and
   * can survive a rollback of the caller's transaction. This is an
   * accepted, documented residual risk (see P0-A-R6 report), not a defect
   * introduced here.
   */
  private async auditStateChange(
    action: string,
    tenantId: string,
    before: TenantBillingState | null,
    after: TenantBillingState,
    reason: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!before || before.status !== after.status) {
      const rows = await (manager ?? this.assertDb()).query(
        `UPDATE tenant_billing_state SET status_changed_at = now() WHERE tenant_id = $1 RETURNING status_changed_at`,
        [tenantId],
      ) as Array<{ status_changed_at: Date }>;
      if (rows[0]) after.status_changed_at = rows[0].status_changed_at;
    }
    await this.audit.log({
      tenantId,
      userId: 'billing:system',
      actorRole: 'system',
      action,
      entity: 'billing',
      entityId: tenantId,
      before,
      after,
      metadata: { reason },
    } as any);
    this.logger.log(`${action}: tenant=${tenantId} reason=${reason}`);
  }
}
