/**
 * billing/dunning.service.ts
 *
 * Dunning NOTIFICATION orchestration — observes `tenant_billing_state` (the
 * single canonical billing-enforcement authority, owned by
 * `BillingEnforcementService` and read by `BillingEnforcementGuard`) and
 * sends the reminder/warning/suspension notice that corresponds to a
 * tenant's REAL enforcement status.
 *
 * P0-A (billing/dunning authority consolidation): this service used to keep
 * its OWN independent escalation ladder (`daysPastDue` derived from
 * `billing_subscriptions.updated_at`, which every unrelated Stripe webhook
 * resets) and, on "hard suspend", wrote directly to
 * `billing_subscriptions.status` / `tenants.{plan,active}` /
 * `organizations.{plan,billing_status}` — three tables
 * `BillingEnforcementGuard` never reads. A tenant "suspended" by that path
 * kept full write access, because the guard only ever consults
 * `tenant_billing_state`. That parallel authority is removed here: this
 * service now NEVER decides tenant access and NEVER writes enforcement
 * state — `BillingEnforcementService.getState()` (called for every tenant
 * this scheduler visits) is the only thing that performs
 * `payment_grace -> read_only -> suspended` escalation, exactly the same
 * lazy mechanism `BillingEnforcementGuard` already relies on for live
 * requests.
 *
 * Why this scheduler still exists: `applyOverrideAndEscalation` only runs
 * as a side effect of `getState()`, which for a live tenant happens on every
 * HTTP request via the guard — but a tenant that stops using the product
 * entirely (the exact shape of a churning, non-paying customer) never
 * triggers another request, so nothing would ever call `getState()` for it
 * again and it would stay frozen at its last observed status forever. This
 * daily sweep exists to call `getState()` for every tenant already flagged
 * `payment_grace`/`read_only`/`suspended`, which (a) actually advances the
 * escalation for inactive tenants and (b) is also the natural point to
 * decide whether a notification is due.
 *
 * Grace/read-only/suspended thresholds, `grace_until` handling and manual
 * override are entirely owned by `BillingEnforcementService` — this file
 * does not duplicate or reimplement any of that.
 */

import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { InjectQueue }   from '@nestjs/bullmq';
import type { Queue }    from 'bullmq';
import { DataSource } from 'typeorm';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { BillingEnforcementService, TenantBillingState } from './billing-enforcement.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { NOTIFICATION_JOB_NAMES } from '../../queues/queue.constants';

/** daily in ms */
const DAY_MS = 24 * 60 * 60 * 1000;

/** find-2532abad: bounded parallelism for per-tenant processing within one cycle. */
const CYCLE_CONCURRENCY = 5;

/**
 * find-e86ed9e1: client-side guard so a slow/hung enumeration query can't
 * wedge the in-flight lock forever.
 * ponytail: this only races a local timer against the query promise — it
 * does not cancel the query on the DB connection itself. Add a real
 * statement_timeout/pg cancel if a hung enumeration query needs to free the
 * underlying connection too, not just unblock the scheduler.
 */
const TENANT_LIST_TIMEOUT_MS = 30_000;

/** find-2e02fed3: consecutive per-tenant cycle failures before escalating the log level. */
const FAILURE_STREAK_THRESHOLD = 5;

type ProcessOutcome = 'processed' | 'skipped';

/**
 * find-2532abad: minimal bounded worker pool — no new dependency, just a
 * shared cursor consumed by `limit` concurrent workers.
 */
async function runBounded<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(workers);
}

type NotifiableStatus = 'payment_grace' | 'read_only' | 'suspended';

interface DunningNotification {
  type: string;
  wsEvent: string;
  message: string;
}

function notificationFor(state: TenantBillingState): DunningNotification | null {
  switch (state.status as NotifiableStatus) {
    case 'payment_grace':
      return {
        type: 'billing.payment_reminder',
        wsEvent: 'billing:payment_reminder',
        message: 'Pagamento em atraso. Atualize o método de pagamento para evitar restrições de acesso.',
      };
    case 'read_only':
      return {
        type: 'billing.soft_suspend_warning',
        wsEvent: 'billing:payment_warning',
        message: 'Conta em modo somente leitura por inadimplência. Atualize o pagamento para restaurar o acesso completo.',
      };
    case 'suspended':
      return {
        type: 'billing.hard_suspend',
        wsEvent: 'billing:suspended',
        message: 'Conta suspensa por inadimplência. Regularize o pagamento para reativar o acesso.',
      };
    default:
      return null; // active/trial/cancelled — nothing to notify
  }
}

@Injectable()
export class DunningService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DunningService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Optional() @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    private readonly enforcement: BillingEnforcementService,
    private readonly ws: RealtimeService,
    @Optional() @InjectQueue('notifications') private readonly notifQueue: Queue | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {}

  /** find-e86ed9e1: in-flight guard — a cycle that outruns the 24h interval (or a manual + scheduled overlap) must not run twice concurrently. */
  private cycleInFlight = false;

  onApplicationBootstrap(): void {
    // Run once at startup, then every 24h. Only runs when DB is available.
    if (!this.ds) return;

    this.runDunningCycle().catch((err: unknown) =>
      this.logger.warn(`Dunning initial run falhou: ${String(err)}`),
    );

    this.intervalRef = setInterval(() => {
      this.runDunningCycle().catch((err: unknown) =>
        this.logger.warn(`Dunning cycle falhou: ${String(err)}`),
      );
    }, DAY_MS);
  }

  async runDunningCycle(): Promise<void> {
    if (!this.ds) return;
    if (this.cycleInFlight) {
      // find-e86ed9e1: previous cycle (still running past its 24h slot, or a
      // manual trigger overlapping the scheduled one) has not finished yet.
      this.logger.warn('Dunning cycle: execução anterior ainda em andamento — pulando este disparo para evitar sobreposição');
      return;
    }

    this.cycleInFlight = true;
    // find-817acade: correlates every log line produced by this cycle run.
    const runId = randomUUID();
    try {
      const tenantIds = await this.withTimeout(
        this.enforcement.listTenantIdsRequiringDunningAttention(),
        TENANT_LIST_TIMEOUT_MS,
        'listTenantIdsRequiringDunningAttention',
      );

      // find-4f07e7c6: real success/failure/skip counters, not tenantIds.length.
      let succeeded = 0;
      let failed = 0;
      let skipped = 0;

      await runBounded(tenantIds, CYCLE_CONCURRENCY, async (tenantId) => {
        try {
          const outcome = await this.processTenant(tenantId, runId);
          if (outcome === 'skipped') {
            skipped++;
            return;
          }
          succeeded++;
          await this.recordDunningOutcome(tenantId, true, runId);
        } catch (err) {
          // Isolate the failure — one tenant must not abort the whole cycle
          // for every other tenant still waiting in this run.
          failed++;
          this.logger.warn(`Dunning[${runId}]: tenant ${tenantId} falhou — ${String(err)}`);
          await this.recordDunningOutcome(tenantId, false, runId);
        }
      });

      if (tenantIds.length > 0) {
        this.logger.log(
          `Dunning cycle[${runId}]: processados ${succeeded}/${tenantIds.length} tenants (falhas=${failed}, pulados=${skipped})`,
        );
      }
    } catch (err) {
      this.logger.error(`Dunning cycle[${runId}] falhou: ${String(err)}`);
    } finally {
      this.cycleInFlight = false;
    }
  }

  /**
   * find-3da8f1fd: a Postgres transaction-scoped advisory lock keyed on the
   * tenant id serializes concurrent `getState()`/escalation attempts for the
   * SAME tenant across replicas. Without this, two replicas racing the same
   * tenant in the same cycle window can each independently observe a status
   * transition and mint a different `status_changed_at` (and therefore a
   * different notification jobId) for what is really one transition — the
   * BullMQ jobId dedup alone cannot catch that, because the two calls never
   * agree on the same key in the first place.
   * `pg_try_advisory_xact_lock` is non-blocking (a losing replica just skips
   * this tenant for this cycle — it will be revisited next cycle since
   * `listTenantIdsRequiringDunningAttention` re-selects it every run) and
   * self-releases when the wrapping transaction ends, so there is no
   * separate unlock call/connection-affinity to get wrong.
   * ponytail: the transaction is only a vehicle for the advisory lock — it
   * holds one pooled connection for the tenant's full processing (including
   * the BullMQ enqueue's network round trip). Fine at today's cycle
   * concurrency (5); move to an explicit connect/lock/unlock if pool
   * pressure ever shows up here.
   */
  private async processTenant(tenantId: string, runId: string): Promise<ProcessOutcome> {
    if (!this.ds) return 'skipped';
    return this.ds.transaction(async (manager) => {
      const [row] = await manager.query(
        `SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked`,
        [tenantId],
      ) as Array<{ locked: boolean }>;
      if (!row?.locked) {
        this.logger.log(`Dunning[${runId}]: tenant ${tenantId} pulado — lock já detido por outra instância/ciclo`);
        return 'skipped';
      }

      // tenant_billing_state is FORCE RLS (20260701000003_BillingRlsHardening).
      // A background cycle has no request-scoped tenant context, so — same
      // reason the old hardSuspend needed it — getState() (and any escalation
      // write it triggers) must run inside runInTenantContext, or it silently
      // sees zero rows under a NOBYPASSRLS app role.
      const state = await this.runInTenantContext(tenantId, () => this.enforcement.getState(tenantId));
      if (!state) {
        this.logger.log(`Dunning[${runId}]: tenant ${tenantId} processado — sem estado de cobrança`);
        return 'processed';
      }

      const notification = notificationFor(state);
      if (notification) {
        this.ws.sendToTenant(tenantId, notification.wsEvent, {
          tenant_id: tenantId,
          status: state.status,
          grace_until: state.grace_until,
          message: notification.message,
        });

        await this.enqueueNotification(tenantId, notification.type, notification.message, state);
      }

      // find-817acade: operators previously only saw failures for this cycle.
      this.logger.log(
        `Dunning[${runId}]: tenant ${tenantId} processado — status=${state.status} notificado=${!!notification}`,
      );
      return 'processed';
    });
  }

  private runInTenantContext<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return this.dbContext
      ? this.dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, () => work())
      : work();
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} excedeu o tempo limite de ${ms}ms`)), ms);
      promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  /**
   * find-2e02fed3: minimal persisted failure-streak tracking, reusing the
   * existing generic `billing_settings` key/value table (no new
   * table/migration needed — see `BillingEnforcementService.getSettings()`
   * for the same table used the same way). A success resets the streak; a
   * failure increments it and escalates the log level once the threshold is
   * crossed, so a tenant that has been silently failing every cycle for
   * months is no longer invisible.
   */
  private async recordDunningOutcome(tenantId: string, success: boolean, runId: string): Promise<void> {
    if (!this.ds) return;
    const key = `dunning_failure_streak:${tenantId}`;
    try {
      if (success) {
        await this.ds.query(`DELETE FROM billing_settings WHERE key = $1`, [key]);
        return;
      }
      const rows = await this.ds.query(
        `INSERT INTO billing_settings (key, value)
         VALUES ($1, jsonb_build_object('streak', 1, 'last_failed_at', now()))
         ON CONFLICT (key) DO UPDATE SET
           value = jsonb_build_object(
             'streak', COALESCE((billing_settings.value->>'streak')::int, 0) + 1,
             'last_failed_at', now()
           ),
           updated_at = now()
         RETURNING (value->>'streak')::int AS streak`,
        [key],
      ) as Array<{ streak: number }>;
      const streak = rows[0]?.streak ?? 1;
      if (streak >= FAILURE_STREAK_THRESHOLD) {
        this.logger.error(
          `Dunning[${runId}]: tenant ${tenantId} ESCALATION — ${streak} falhas consecutivas de ciclo (limite=${FAILURE_STREAK_THRESHOLD})`,
        );
      }
    } catch (err) {
      this.logger.warn(`Dunning[${runId}]: falha ao persistir failure-streak do tenant ${tenantId} — ${String(err)}`);
    }
  }

  /**
   * P0-A-R5: dedup via BullMQ's own jobId mechanism, keyed on
   * `tenant_billing_state.status_changed_at` — NOT `updated_at`.
   * `updated_at` is a general "last touched" audit stamp bumped by several
   * writers (including admin-panel edits) even without a real status change;
   * `status_changed_at` is set only by `BillingEnforcementService` when
   * `before.status !== after.status`, so a tenant stuck in the same status
   * across N consecutive daily cycles — or touched by an unrelated write in
   * between — still gets exactly ONE notification per transition, not one
   * per cycle/write.
   *
   * `removeOnComplete` is overridden per-job (not the shared queue default)
   * to outlive the longest realistic billing episode, so the dedup key
   * doesn't lose its BullMQ-side backstop if this job is GC'd by the shared
   * `notifications` queue's default retention before the episode ends.
   */
  private async enqueueNotification(
    tenantId: string, type: string, title: string, state: TenantBillingState,
  ): Promise<void> {
    if (!this.notifQueue) return;
    const transitionKey = new Date(state.status_changed_at).getTime();
    const jobId = `dunning-notify:${tenantId}:${state.status}:${transitionKey}`;
    try {
      // find-27fef1de: BullMQ never recreates a job whose id already exists,
      // so once a job for this exact transition has exhausted its 3 attempts
      // and landed in 'failed', a plain `add()` with the same jobId is a
      // silent no-op forever — the tenant never gets that notice again.
      // Retry the existing failed job instead of dropping it.
      const existing = await this.notifQueue.getJob(jobId);
      if (existing) {
        const jobState = await existing.getState();
        if (jobState === 'failed') {
          this.logger.error(`Dunning: notificação ${type} para tenant ${tenantId} tinha falhado permanentemente (jobId=${jobId}) — reenviando`);
          await existing.retry();
        }
        return;
      }
      await this.notifQueue.add(
        NOTIFICATION_JOB_NAMES.SEND,
        { tenantId, title, type, metadata: { tenantId, status: state.status, graceUntil: state.grace_until } },
        { attempts: 3, jobId, removeOnComplete: { age: 60 * 60 * 24 * 30 } },
      );
    } catch (err) {
      // find-27fef1de: escalated to error — a silently dropped notification
      // enqueue is exactly the failure mode this finding calls out.
      this.logger.error(`Dunning: enqueue notification ${type} falhou (ação necessária) — ${String(err)}`);
    }
  }
}
