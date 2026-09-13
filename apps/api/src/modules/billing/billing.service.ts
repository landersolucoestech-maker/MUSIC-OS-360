import { Optional, Injectable, BadRequestException, Logger, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import {
  BillingSubscriptionEntity,
  TenantEntity,
  OrganizationEntity,
  WebhookEventEntity,
} from '../../database/entities';
import { WebhookEventStatus } from '@music-os-360/types';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { BillingEnforcementService, TenantBillingStatus } from './billing-enforcement.service';
import { BillingPlansService } from './billing-plans.service';
import { classifyStripeSecretKeyFormat } from '../../core/config/stripe-key-guard';
import { AdminListQueryDto, UpdateAdminTenantDto } from './dto/admin-billing.dto';
import { DatabaseContextService } from '../../database/database-context.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeRaw = require('stripe');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StripeClass: new (key: string, opts: Record<string, unknown>) => StripeClient =
  (StripeRaw as any).default ?? StripeRaw;

interface StripeClient {
  checkout: { sessions: { create(params: Record<string, unknown>): Promise<{ url: string | null; id: string }> } };
  billingPortal: { sessions: { create(params: Record<string, unknown>): Promise<{ url: string }> } };
  webhooks: { constructEvent(payload: string | Buffer, header: string, secret: string): StripeWebhookEvent };
}

interface StripeCheckoutSession {
  customer: string | null;
  subscription: string | null;
  metadata?: Record<string, string> | null;
}

interface StripeSubscription {
  id: string;
  status: string;
  customer?: string | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  trial_end?: number | null;
  cancel_at_period_end?: boolean;
  items?: { data?: Array<{ price?: { id?: string | null } | null }> } | null;
  metadata?: Record<string, string> | null;
}

interface StripeInvoice {
  id: string;
  customer: string | null;
  subscription?: string | null;
  amount_due?: number | null;
  amount_paid?: number | null;
  currency?: string | null;
  status?: string | null;
  due_date?: number | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  attempt_count?: number | null;
  metadata?: Record<string, string> | null;
}

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
  /** Unix seconds — Stripe's own event-creation time, used for stale/out-of-order delivery checks (find-99ea599c). */
  created?: number;
}

export const PLAN_FEATURES = {
  starter: {
    moduleArtists: true, moduleCatalog: true, moduleContracts: true, moduleCrm: true,
    moduleMarketing: false, moduleAccounting: false, moduleMonitoring: false, aiFeatures: false, moduleRh: false,
  },
  professional: {
    moduleArtists: true, moduleCatalog: true, moduleContracts: true, moduleCrm: true,
    moduleMarketing: true, moduleAccounting: true, moduleMonitoring: true, aiFeatures: false,
    moduleRh: true, moduleEvents: true, moduleInventory: true,
  },
  enterprise: {
    moduleArtists: true, moduleCatalog: true, moduleContracts: true, moduleCrm: true,
    moduleMarketing: true, moduleAccounting: true, moduleMonitoring: true, aiFeatures: true,
    moduleRh: true, moduleEvents: true, moduleInventory: true, moduleLicensing: true,
    multiTenantAdmin: true, analyticsAdvanced: true,
  },
} as const;

export const PLAN_LIMITS: Record<string, {
  artists: number | null;
  contracts: number | null;
  storageGb: number | null;
  users: number | null;
  monthlyAiUsd: number | null;
}> = {
  starter: { artists: 5, contracts: 20, storageGb: 5, users: 3, monthlyAiUsd: 2 },
  professional: { artists: 50, contracts: 200, storageGb: 50, users: 15, monthlyAiUsd: 20 },
  enterprise: { artists: null, contracts: null, storageGb: null, users: null, monthlyAiUsd: null },
};

type Plan = keyof typeof PLAN_FEATURES;

interface AdminTenantRow {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  plan: string | null;
  owner_email: string | null;
  users_count: string | number | null;
  artists_count: string | number | null;
  storage_used_mb: string | number | null;
  storage_limit_mb: string | number | null;
  mrr: string | number | null;
  created_at: Date | string;
  last_active_at: Date | string | null;
  country: string | null;
  trial_ends_at: Date | string | null;
}

interface AdminSubscriptionRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  plan: string | null;
  status: string | null;
  mrr: string | number | null;
  billing_cycle: string | null;
  started_at: Date | string;
  current_period_end: Date | string | null;
  payment_method: string | null;
  trial_ends_at: Date | string | null;
  last_payment_at: Date | string | null;
  next_payment_at: Date | string | null;
}

interface AdminInvoiceRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  stripe_invoice_id: string | null;
  status: string;
  amount_due: string | number | null;
  amount_paid: string | number | null;
  currency: string | null;
  due_date: Date | string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: Date | string;
}

function stripeDate(seconds?: number | null): Date | null {
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000)
    : null;
}

function normalizeSubscriptionStatus(status: string): string {
  return status === 'canceled' ? 'cancelled' : status;
}

@Injectable()
export class BillingService {
  private readonly stripe: StripeClient | null = null;
  private readonly logger = new Logger(BillingService.name);
  private readonly subRepo: Repository<BillingSubscriptionEntity> | null = null;
  private readonly tenantRepo: Repository<TenantEntity> | null = null;
  private readonly orgRepo: Repository<OrganizationEntity> | null = null;
  private readonly webhookRepo: Repository<WebhookEventEntity> | null = null;

  constructor(
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | undefined,
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    private readonly ws: RealtimeService,
    private readonly events: EventsService,
    private readonly enforcement: BillingEnforcementService,
    private readonly plans: BillingPlansService,
    private readonly dbContext: DatabaseContextService,
  ) {
    if (ds) {
      this.subRepo = ds.getRepository(BillingSubscriptionEntity);
      this.tenantRepo = ds.getRepository(TenantEntity);
      this.orgRepo = ds.getRepository(OrganizationEntity);
      this.webhookRepo = ds.getRepository(WebhookEventEntity);
    }
    const key = this.config?.get<string>('STRIPE_SECRET_KEY') ?? process.env.STRIPE_SECRET_KEY;
    const keyState = classifyStripeSecretKeyFormat(key);
    switch (keyState) {
      case 'VALID_TEST_KEY':
        this.stripe = new StripeClass(key as string, { apiVersion: '2026-04-22.dahlia' });
        this.logger.log('Stripe Billing inicializado (TEST MODE)');
        break;
      case 'LIVE_KEY_REJECTED':
        this.logger.error('STRIPE_SECRET_KEY e uma chave LIVE - recusada. Este projeto opera exclusivamente em TEST MODE. Billing desativado.');
        break;
      case 'INVALID_FORMAT':
        this.logger.warn('STRIPE_SECRET_KEY nao tem um formato Stripe reconhecido - Billing desativado');
        break;
      case 'MISSING':
      default:
        this.logger.warn('STRIPE_SECRET_KEY nao configurada - Billing desativado');
    }
  }

  private get stripeRequired(): StripeClient {
    if (!this.stripe) throw new BadRequestException('Stripe nao configurado neste ambiente');
    return this.stripe;
  }

  private assertBillingRepositories(): void {
    if (!this.ds || !this.subRepo || !this.tenantRepo || !this.orgRepo) {
      throw new ServiceUnavailableException('Billing persistence unavailable');
    }
  }

  private assertDataSource(): DataSource {
    if (!this.ds) throw new ServiceUnavailableException('Billing persistence unavailable');
    return this.ds;
  }

  private toIso(value: Date | string | null | undefined): string {
    if (!value) return '';
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private toOptionalIso(value: Date | string | null | undefined): string | undefined {
    if (!value) return undefined;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  async listAdminTenants(query: AdminListQueryDto = {}) {
    const ds = this.assertDataSource();
    const params: unknown[] = [];
    const filters: string[] = ['t.deleted_at IS NULL'];
    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      filters.push(`(lower(t.name) LIKE $${params.length} OR lower(t.slug) LIKE $${params.length} OR lower(COALESCE(owner.email, '')) LIKE $${params.length})`);
    }
    if (query.status && query.status !== 'all') {
      params.push(query.status);
      filters.push(`COALESCE(state.status, bs.status, CASE WHEN t.active THEN 'active' ELSE 'suspended' END) = $${params.length}`);
    }
    if (query.plan && query.plan !== 'all') {
      params.push(query.plan);
      filters.push(`COALESCE(bs.plan, t.plan) = $${params.length}`);
    }

    const rows = await ds.query(
      `
      SELECT
        t.id,
        t.name,
        t.slug,
        COALESCE(state.status, bs.status, CASE WHEN t.active THEN 'active' ELSE 'suspended' END) AS status,
        COALESCE(bs.plan, t.plan) AS plan,
        COALESCE(owner.email, '') AS owner_email,
        COALESCE(users.users_count, 0) AS users_count,
        COALESCE(artists.artists_count, 0) AS artists_count,
        0 AS storage_used_mb,
        COALESCE(((bp.limits ->> 'storageGb')::numeric * 1024), 0) AS storage_limit_mb,
        CASE
          WHEN bp.interval = 'year' THEN COALESCE(bp.amount, 0)::numeric / 1200
          ELSE COALESCE(bp.amount, 0)::numeric / 100
        END AS mrr,
        t.created_at,
        t.updated_at AS last_active_at,
        COALESCE(t.settings ->> 'country', '') AS country,
        bs.trial_ends_at
      FROM tenants t
      LEFT JOIN billing_subscriptions bs ON bs.tenant_id = t.id
      LEFT JOIN tenant_billing_state state ON state.tenant_id = t.id
      LEFT JOIN billing_plans bp ON bp.slug = COALESCE(bs.plan, t.plan)
      LEFT JOIN LATERAL (
        SELECT email
        FROM org_members om
        WHERE om.tenant_id = t.id
          AND om.deleted_at IS NULL
          AND om.is_active = true
        ORDER BY CASE WHEN om.role = 'owner' THEN 0 WHEN om.role = 'admin' THEN 1 ELSE 2 END, om.created_at ASC
        LIMIT 1
      ) owner ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS users_count
        FROM org_members om
        WHERE om.tenant_id = t.id
          AND om.deleted_at IS NULL
          AND om.is_active = true
      ) users ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS artists_count
        FROM artists a
        WHERE a.tenant_id = t.id
          AND a.deleted_at IS NULL
      ) artists ON true
      WHERE ${filters.join(' AND ')}
      ORDER BY t.created_at DESC
      LIMIT 500
      `,
      params,
    ) as AdminTenantRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status ?? 'pending',
      plan: row.plan ?? 'starter',
      owner_email: row.owner_email ?? '',
      users_count: Number(row.users_count ?? 0),
      artists_count: Number(row.artists_count ?? 0),
      storage_used_mb: Number(row.storage_used_mb ?? 0),
      storage_limit_mb: Number(row.storage_limit_mb ?? 0),
      mrr: Math.round(Number(row.mrr ?? 0)),
      created_at: this.toIso(row.created_at),
      last_active_at: this.toIso(row.last_active_at ?? row.created_at),
      country: row.country ?? '',
      trial_ends_at: this.toOptionalIso(row.trial_ends_at),
    }));
  }

  /**
   * P0-A-R6: the only `TenantBillingStatus` values `updateAdminTenant` is
   * allowed to dispatch — 'trial'/'pending'/anything else is rejected
   * up front (defense-in-depth only, see the method body for the real fix).
   */
  private static readonly ADMIN_SETTABLE_BILLING_STATUSES = new Set<string>([
    'active', 'suspended', 'cancelled', 'past_due',
  ] satisfies Array<TenantBillingStatus | 'past_due'>);

  /**
   * P0-A-R3/R4: `body.status` (a billing concept — `TenantBillingStatus`)
   * used to be written two ways at once: a raw `tenant_billing_state` upsert
   * right here (bypassing `BillingEnforcementService` entirely — no audit
   * trail, no `billing_subscriptions` sync, no `status_changed_at`) AND an
   * independently-derived `tenant.active` flip. `tenants.active` is a
   * genuine, separate LIFECYCLE concept (tenant existence/deactivation,
   * alongside `deleted_at` — see `leads.service.ts`/
   * `workspace-provisioning.service.ts`), not a billing duplicate; deriving
   * it from a billing status string was itself the conflation this fixes.
   * `BillingEnforcementService` is now the only writer of
   * `tenant_billing_state` anywhere in the codebase — this admin action
   * dispatches to its existing, already-audited transition methods instead
   * of reimplementing the write.
   */
  async updateAdminTenant(tenantId: string, body: UpdateAdminTenantDto) {
    // P0-A-R6 defense-in-depth: reject an unsupported status up front, before
    // any write happens. This alone does NOT close the atomicity bug (a DB
    // error or a business exception from the enforcement dispatch below can
    // still fail after other statements ran) — the real fix is that the
    // entire method, including the enforcement dispatch, now shares the one
    // transaction opened below, so any failure rolls back everything.
    if (body.status !== undefined && !BillingService.ADMIN_SETTABLE_BILLING_STATUSES.has(body.status)) {
      throw new BadRequestException(
        `Status "${body.status}" nao pode ser definido manualmente via este endpoint`,
      );
    }

    const ds = this.assertDataSource();
    await ds.transaction(async (manager) => {
      const tenant = await manager.getRepository(TenantEntity).findOne({ where: { id: tenantId } });
      if (!tenant || tenant.deleted_at) throw new BadRequestException('Tenant nao encontrado');

      if (body.name !== undefined) tenant.name = body.name;
      if (body.slug !== undefined) tenant.slug = body.slug;
      if (body.plan !== undefined) tenant.plan = body.plan as any;
      if (body.country !== undefined) {
        tenant.settings = { ...(tenant.settings ?? {}), country: body.country };
      }
      await manager.getRepository(TenantEntity).save(tenant);

      if (body.owner_email !== undefined) {
        await manager.query(
          `
          UPDATE org_members
             SET email = $2,
                 updated_at = now()
           WHERE id = (
             SELECT id
               FROM org_members
              WHERE tenant_id = $1
                AND deleted_at IS NULL
              ORDER BY CASE WHEN role = 'owner' THEN 0 WHEN role = 'admin' THEN 1 ELSE 2 END, created_at ASC
              LIMIT 1
           )
          `,
          [tenantId, body.owner_email],
        );
      }

      // P0-A-R6: this dispatch used to run AFTER the transaction above had
      // already committed — an invalid status or an exception here left the
      // tenant/org_members writes persisted with the caller seeing a failure
      // response implying nothing was applied (partial commit). It now runs
      // inside the same transaction, sharing `manager`, so any throw here
      // rolls back the tenant/org_members writes too.
      if (body.status !== undefined) {
        const reason = `admin panel: tenant status set to ${body.status}`;
        switch (body.status) {
          case 'suspended':
            await this.enforcement.suspendTenant(tenantId, reason, new Date(), manager);
            break;
          case 'active':
            await this.enforcement.activateTenant(tenantId, reason, new Date(), manager);
            break;
          case 'cancelled':
            await this.enforcement.cancelTenant(tenantId, reason, manager);
            break;
          case 'past_due':
            await this.enforcement.startPaymentGrace(tenantId, reason, new Date(), manager);
            break;
        }
      }
    });

    const tenants = await this.listAdminTenants({});
    return tenants.find((tenant) => tenant.id === tenantId) ?? null;
  }

  async listAdminSubscriptions(query: AdminListQueryDto = {}) {
    const ds = this.assertDataSource();
    const params: unknown[] = [];
    const filters: string[] = ['t.deleted_at IS NULL'];
    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      filters.push(`lower(t.name) LIKE $${params.length}`);
    }
    if (query.status && query.status !== 'all') {
      params.push(query.status);
      filters.push(`COALESCE(state.status, bs.status, 'trial') = $${params.length}`);
    }
    if (query.plan && query.plan !== 'all') {
      params.push(query.plan);
      filters.push(`COALESCE(bs.plan, t.plan) = $${params.length}`);
    }

    const rows = await ds.query(
      `
      SELECT
        COALESCE(bs.id::text, state.id::text, t.id::text) AS id,
        t.id AS tenant_id,
        t.name AS tenant_name,
        COALESCE(bs.plan, t.plan) AS plan,
        COALESCE(state.status, bs.status, 'trial') AS status,
        CASE
          WHEN bp.interval = 'year' THEN COALESCE(bp.amount, 0)::numeric / 1200
          ELSE COALESCE(bp.amount, 0)::numeric / 100
        END AS mrr,
        CASE WHEN bp.interval = 'year' THEN 'annual' ELSE 'monthly' END AS billing_cycle,
        COALESCE(bs.current_period_start, bs.created_at, t.created_at) AS started_at,
        bs.current_period_end,
        COALESCE(bs.metadata ->> 'payment_method', 'Stripe') AS payment_method,
        bs.trial_ends_at,
        state.last_payment_at,
        COALESCE(state.next_payment_at, bs.current_period_end) AS next_payment_at
      FROM tenants t
      LEFT JOIN billing_subscriptions bs ON bs.tenant_id = t.id
      LEFT JOIN tenant_billing_state state ON state.tenant_id = t.id
      LEFT JOIN billing_plans bp ON bp.slug = COALESCE(bs.plan, t.plan)
      WHERE ${filters.join(' AND ')}
      ORDER BY COALESCE(state.updated_at, bs.updated_at, t.updated_at) DESC
      LIMIT 500
      `,
      params,
    ) as AdminSubscriptionRow[];

    return rows.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      plan: row.plan ?? 'starter',
      status: normalizeSubscriptionStatus(row.status ?? 'trial'),
      mrr: Math.round(Number(row.mrr ?? 0)),
      billing_cycle: row.billing_cycle === 'annual' ? 'annual' : 'monthly',
      started_at: this.toIso(row.started_at),
      current_period_end: this.toIso(row.current_period_end ?? row.started_at),
      payment_method: row.payment_method ?? 'Stripe',
      trial_ends_at: this.toOptionalIso(row.trial_ends_at),
      last_payment_at: this.toOptionalIso(row.last_payment_at),
      next_payment_at: this.toOptionalIso(row.next_payment_at),
    }));
  }

  async listAdminInvoices(query: AdminListQueryDto & { tenantId?: string } = {}) {
    const ds = this.assertDataSource();
    const params: unknown[] = [];
    const filters: string[] = ['i.deleted_at IS NULL'];
    if (query.tenantId) {
      params.push(query.tenantId);
      filters.push(`i.tenant_id = $${params.length}`);
    }
    if (query.status && query.status !== 'all') {
      params.push(query.status);
      filters.push(`i.status = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      filters.push(`(lower(t.name) LIKE $${params.length} OR lower(COALESCE(i.stripe_invoice_id, '')) LIKE $${params.length})`);
    }
    const rows = await ds.query(
      `
      SELECT
        i.id,
        i.tenant_id,
        t.name AS tenant_name,
        i.stripe_invoice_id,
        i.status,
        i.amount_due,
        i.amount_paid,
        i.currency,
        i.due_date,
        i.hosted_invoice_url,
        i.invoice_pdf,
        i.created_at
      FROM invoices i
      JOIN tenants t ON t.id = i.tenant_id
      WHERE ${filters.join(' AND ')}
      ORDER BY i.created_at DESC
      LIMIT 500
      `,
      params,
    ) as AdminInvoiceRow[];
    return rows.map((row) => ({
      ...row,
      amount_due: Number(row.amount_due ?? 0),
      amount_paid: Number(row.amount_paid ?? 0),
      due_date: this.toOptionalIso(row.due_date),
      created_at: this.toIso(row.created_at),
    }));
  }

  async createCheckoutSession(params: {
    orgId: string; tenantId: string; planRef?: string; successUrl: string; cancelUrl: string;
  }) {
    this.assertBillingRepositories();

    // Fonte primária do preço = banco (plano). NUNCA STRIPE_PRICE_* do env.
    if (!params.planRef) throw new BadRequestException('Plano não informado (planId ou planSlug)');
    const plan = await this.plans.resolve(params.planRef);
    if (!plan || !plan.active) throw new BadRequestException(`Plano inválido ou inativo: ${params.planRef}`);
    if (!plan.stripe_price_id) {
      throw new BadRequestException(`Plano '${plan.slug}' não sincronizado com Stripe`);
    }

    const sub = await this.subRepo!
      .createQueryBuilder('s')
      .where('s.org_id = :orgId', { orgId: params.orgId })
      .getOne();

    const customer = (sub?.stripe_customer_id && !sub.stripe_customer_id.startsWith('pending_'))
      ? sub.stripe_customer_id
      : undefined;

    const session = await this.stripeRequired.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      metadata: {
        tenant_id: params.tenantId,
        org_id: params.orgId,
        plan_id: plan.id,
        plan: plan.slug,
        stripe_price_id: plan.stripe_price_id,
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return { url: session.url };
  }

  async createPortalSession(orgId: string, returnUrl: string) {
    this.assertBillingRepositories();
    const sub = await this.subRepo!
      .createQueryBuilder('s')
      .where('s.org_id = :orgId', { orgId })
      .getOne();

    if (!sub?.stripe_customer_id || sub.stripe_customer_id.startsWith('pending_')) {
      throw new BadRequestException('Sem assinatura Stripe ativa');
    }

    const session = await this.stripeRequired.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(signature: string | undefined, rawBody: Buffer | undefined) {
    this.assertBillingRepositories();

    const secret = this.config?.get<string>('STRIPE_WEBHOOK_SECRET') ?? process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('Stripe webhook secret unavailable');
    if (!signature) throw new BadRequestException('Stripe signature missing');
    if (!rawBody || !Buffer.isBuffer(rawBody)) throw new BadRequestException('Stripe raw body missing');

    let event: StripeWebhookEvent;
    try {
      event = this.stripeRequired.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Assinatura Stripe inválida');
    }

    const tenantId = await this.resolveTenantIdFromEvent(event);

    // find-03176eef: webhook_events/payment_events/tenant_billing_state RLS
    // now requires an explicit system-path marker (app_is_system_context())
    // instead of "no tenant context set" — declare it here rather than
    // relying on this connection happening to have no session var bound.
    // When the event DOES resolve to a tenant, use the normal tenant path
    // (role left unset) so the ordinary tenant_id = app_current_tenant_id()
    // branch applies, same as every other tenant-scoped write.
    return this.dbContext.runInTenantContext(
      { tenantId, orgId: null, role: tenantId ? null : 'system' },
      () => this.processWebhookEvent(event, tenantId),
    );
  }

  private async processWebhookEvent(
    event: StripeWebhookEvent,
    tenantId: string | null,
  ): Promise<{ received: boolean }> {
    const insertStatus = await this.enforcement.recordWebhookProcessed({
      tenantId,
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
    if (insertStatus === 'duplicate') {
      this.logger.log(`Webhook Stripe ja processado: ${event.id}`);
      return { received: true };
    }

    try {
      await this.processEvent(event, tenantId);
      await this.enforcement.markWebhookProcessed(event.id);
      await this.recordLegacyWebhook(event, tenantId, WebhookEventStatus.PROCESSED);
    } catch (err) {
      await this.enforcement.markWebhookFailed(event.id);
      await this.recordLegacyWebhook(event, tenantId, WebhookEventStatus.FAILED, (err as Error).message);
      throw err;
    }

    return { received: true };
  }

  private async processEvent(event: StripeWebhookEvent, resolvedTenantId: string | null) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as StripeCheckoutSession);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.onSubUpdated(event.data.object as StripeSubscription, resolvedTenantId);
        break;
      case 'customer.subscription.deleted':
        await this.onSubCanceled(event.data.object as StripeSubscription, resolvedTenantId);
        break;
      case 'invoice.payment_succeeded':
      case 'invoice.paid':
        await this.onPaymentSucceeded(event.data.object as StripeInvoice, resolvedTenantId, event.created);
        break;
      case 'invoice.payment_failed':
      case 'invoice.payment_action_required':
        await this.onPaymentFailed(event.data.object as StripeInvoice, resolvedTenantId, event.created);
        break;
      case 'invoice.finalized':
      case 'invoice.voided':
        await this.upsertStripeInvoice(event.data.object as StripeInvoice, resolvedTenantId);
        break;
      case 'invoice.marked_uncollectible':
        await this.onInvoiceUncollectible(event.data.object as StripeInvoice, resolvedTenantId);
        break;
      default:
        this.logger.debug(`Evento Stripe ignorado: ${event.type}`);
    }
  }

  private async onCheckoutCompleted(session: StripeCheckoutSession) {
    const { tenant_id, org_id, plan, plan_id, stripe_price_id } = session.metadata ?? {};
    if (!tenant_id || !org_id || !plan) {
      // Contrato produtor↔consumidor: createCheckoutSession DEVE injetar metadata
      // {tenant_id, org_id, plan}. Sem isso, a assinatura pode ter sido paga sem
      // provisionar o tenant — não é erro de processamento, mas exige visibilidade.
      this.logger.warn(
        `checkout.session.completed ignorado: metadata incompleta ` +
          `(customer=${session.customer ?? '∅'}, subscription=${session.subscription ?? '∅'}, ` +
          `tenant_id=${tenant_id ?? '∅'}, org_id=${org_id ?? '∅'}, plan=${plan ?? '∅'}).`,
      );
      return;
    }

    const features = PLAN_FEATURES[plan as Plan] ?? PLAN_FEATURES.starter;

    // find-0b089515 / find-9fd92b12: a partial failure later in this handler
    // marks the webhook 'failed', and a genuine Stripe retry reclaims + re-runs
    // the whole method. The upserts below are idempotent, but the realtime
    // notification and TENANT_CREATED event are not. `org.billing_status ===
    // 'active'` is NOT a safe proxy for "this is a retry" — a real second
    // checkout (e.g. professional -> enterprise upgrade) also finds the org
    // already active. Identify a retry precisely instead: same subscription
    // id AND same plan already recorded and already active — i.e. this exact
    // checkout's effect is already applied, not just "some plan is active".
    const subBefore = await this.subRepo!
      .createQueryBuilder('s')
      .select(['s.stripe_sub_id', 's.plan', 's.status'])
      .where('s.org_id = :orgId', { orgId: org_id })
      .getOne();
    const isRetryOfSameCheckout =
      !!session.subscription &&
      subBefore?.stripe_sub_id === session.subscription &&
      subBefore?.plan === plan &&
      subBefore?.status === 'active';

    await this.subRepo!
      .createQueryBuilder()
      .update(BillingSubscriptionEntity)
      .set({
        tenant_id,
        stripe_customer_id: session.customer ?? undefined,
        stripe_sub_id: session.subscription ?? undefined,
        stripe_subscription_id: session.subscription ?? undefined,
        stripe_price_id: stripe_price_id ?? undefined,
        plan,
        status: 'active',
        trial_ends_at: null,
        updated_at: new Date(),
      } as any)
      .where('org_id = :orgId', { orgId: org_id })
      .execute();

    await this.tenantRepo!
      .createQueryBuilder()
      .update(TenantEntity)
      .set({ plan, features, active: true, updated_at: new Date() } as any)
      .where('id = :tenantId', { tenantId: tenant_id })
      .execute();

    await this.orgRepo!
      .createQueryBuilder()
      .update(OrganizationEntity)
      .set({ plan, billing_status: 'active', updated_at: new Date() } as any)
      .where('id = :orgId', { orgId: org_id })
      .execute();

    await this.enforcement.activateTenant(tenant_id, 'checkout.session.completed');

    if (isRetryOfSameCheckout) return;

    this.ws.sendToTenant(tenant_id, 'billing:plan_upgraded', { org_id, plan, plan_id: plan_id ?? null });

    const tenantRecord = await this.tenantRepo!
      .createQueryBuilder('t')
      .select(['t.id', 't.name', 't.slug', 't.plan'])
      .where('t.id = :tenantId', { tenantId: tenant_id })
      .getOne();

    if (tenantRecord) {
      this.events.emitTyped(DOMAIN_EVENTS.TENANT_CREATED, {
        tenantId: tenant_id,
        userId: 'billing:checkout',
        aggregateType: 'tenant',
        aggregateId: tenant_id,
        payload: {
          tenantId: tenant_id,
          name: tenantRecord.name,
          slug: tenantRecord.slug,
          plan: plan as string,
        },
      });
    }
  }

  private async onSubUpdated(sub: StripeSubscription, resolvedTenantId: string | null) {
    const tenantId = resolvedTenantId ?? sub.metadata?.['tenant_id'] ?? null;
    if (!tenantId) return;
    const applied = await this.upsertStripeSubscription(sub, tenantId);
    // find-602e8654: the subscription row rejected this event as stale
    // (an older period than what's already stored) — don't apply a billing
    // status transition derived from data that didn't actually land.
    if (!applied) return;

    const status = normalizeSubscriptionStatus(sub.status);
    if (status === 'active') await this.enforcement.activateTenant(tenantId, 'customer.subscription.updated');
    else if (status === 'trialing') await this.enforcement.ensureState(tenantId);
    else if (status === 'past_due' || status === 'unpaid') await this.enforcement.startPaymentGrace(tenantId, 'customer.subscription.updated');
    else if (status === 'cancelled' || status === 'incomplete_expired') await this.enforcement.cancelTenant(tenantId, 'customer.subscription.updated');
  }

  private async onSubCanceled(sub: StripeSubscription, resolvedTenantId: string | null) {
    const tenantId = resolvedTenantId ?? sub.metadata?.['tenant_id'] ?? null;
    const orgId = sub.metadata?.['org_id'] ?? await this.resolveOrgIdForTenant(tenantId);
    if (!tenantId || !orgId) return;

    const applied = await this.upsertStripeSubscription({ ...sub, status: 'cancelled' }, tenantId);
    // find-602e8654: a stale/replayed cancellation for an already-superseded
    // period must not cancel a subscription that has since moved forward.
    if (!applied) return;
    await this.orgRepo!
      .createQueryBuilder()
      .update(OrganizationEntity)
      .set({ billing_status: 'cancelled', updated_at: new Date() } as any)
      .where('id = :orgId', { orgId })
      .execute();

    await this.enforcement.cancelTenant(tenantId, 'customer.subscription.deleted');
    this.ws.sendToTenant(tenantId, 'billing:cancelled', { org_id: orgId });
  }

  /**
   * find-99ea599c: invoice.payment_succeeded/failed used to apply activateTenant()/
   * startPaymentGrace() unconditionally, unlike onSubUpdated/onSubCanceled which
   * already reject a write older than what's stored (find-602e8654). Stripe
   * delivers webhooks at-least-once and out of order; a late invoice event for an
   * already-superseded state must not resurrect it. tenant_billing_state.status_changed_at
   * only advances on a REAL status transition (auditStateChange), so an event whose
   * own creation time predates it is, by definition, stale relative to a newer
   * transition that already landed.
   */
  private isStaleInvoiceEvent(state: { status_changed_at?: Date | string | null } | null, eventCreatedAtSec?: number): boolean {
    if (!state?.status_changed_at || eventCreatedAtSec == null) return false;
    return new Date(eventCreatedAtSec * 1000) < new Date(state.status_changed_at);
  }

  private async onPaymentSucceeded(invoice: StripeInvoice, resolvedTenantId: string | null, eventCreatedAtSec?: number) {
    const tenantId = resolvedTenantId ?? await this.resolveTenantIdFromInvoice(invoice);
    await this.upsertStripeInvoice(invoice, tenantId);
    if (!tenantId) return;

    const state = await this.enforcement.getState(tenantId);
    if (this.isStaleInvoiceEvent(state, eventCreatedAtSec)) {
      this.logger.log(`invoice.payment_succeeded ignorado (stale): tenant=${tenantId} invoice=${invoice.id}`);
      return;
    }
    await this.enforcement.activateTenant(tenantId, 'invoice.payment_succeeded');
    this.ws.sendToTenant(tenantId, 'billing:payment_succeeded', {
      invoice_id: invoice.id,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    });
  }

  private async onPaymentFailed(invoice: StripeInvoice, resolvedTenantId: string | null, eventCreatedAtSec?: number) {
    const tenantId = resolvedTenantId ?? await this.resolveTenantIdFromInvoice(invoice);
    await this.upsertStripeInvoice(invoice, tenantId);
    if (!tenantId) return;

    const state = await this.enforcement.getState(tenantId);
    if (this.isStaleInvoiceEvent(state, eventCreatedAtSec)) {
      this.logger.log(`invoice.payment_failed ignorado (stale): tenant=${tenantId} invoice=${invoice.id}`);
      return;
    }
    await this.enforcement.startPaymentGrace(tenantId, 'invoice.payment_failed');
    await this.orgRepo!
      .createQueryBuilder()
      .update(OrganizationEntity)
      .set({ billing_status: 'past_due', updated_at: new Date() } as any)
      .where('id = (SELECT org_id FROM tenants WHERE id = :tenantId)', { tenantId })
      .execute();

    this.ws.sendToTenant(tenantId, 'billing:payment_failed', {
      invoice_id: invoice.id,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      message: 'Pagamento recusado - atualize o metodo de pagamento para manter o acesso',
    });
  }

  private async onInvoiceUncollectible(invoice: StripeInvoice, resolvedTenantId: string | null) {
    const tenantId = resolvedTenantId ?? await this.resolveTenantIdFromInvoice(invoice);
    await this.upsertStripeInvoice(invoice, tenantId);
    if (tenantId) await this.enforcement.suspendTenant(tenantId, 'invoice.marked_uncollectible');
  }

  /**
   * @returns false when the write was rejected as stale (find-602e8654's WHERE
   * guard matched zero rows) — callers must not apply a status transition
   * derived from an event whose subscription-row write didn't actually land.
   */
  private async upsertStripeSubscription(sub: StripeSubscription, tenantId: string): Promise<boolean> {
    const orgId = sub.metadata?.['org_id'] ?? await this.resolveOrgIdForTenant(tenantId);
    if (!orgId || !this.ds) return false;
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    const status = normalizeSubscriptionStatus(sub.status);
    const result = await this.ds.query(
      `INSERT INTO billing_subscriptions (
         tenant_id, org_id, stripe_customer_id, stripe_sub_id, stripe_subscription_id, stripe_price_id,
         plan, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end, updated_at
       )
       VALUES ($1, $2, $3, $4, $4, $5, COALESCE($6, 'starter'), $7, $8, $9, $10, $11, now())
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, billing_subscriptions.stripe_customer_id),
         stripe_sub_id = EXCLUDED.stripe_sub_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, billing_subscriptions.stripe_price_id),
         plan = COALESCE(EXCLUDED.plan, billing_subscriptions.plan),
         status = EXCLUDED.status,
         trial_ends_at = EXCLUDED.trial_ends_at,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         updated_at = now()
       -- find-602e8654: Stripe delivers webhooks at-least-once, not in order.
       -- Reject a write whose period is strictly OLDER than what's already
       -- stored so a delayed/replayed stale event can't resurrect or clobber
       -- a subscription's state after a newer event already advanced it.
       -- Same-period status changes (NULL on either side included) still apply.
       WHERE billing_subscriptions.current_period_start IS NULL
          OR EXCLUDED.current_period_start IS NULL
          OR EXCLUDED.current_period_start >= billing_subscriptions.current_period_start
       RETURNING tenant_id`,
      [
        tenantId,
        orgId,
        sub.customer ?? null,
        sub.id,
        priceId,
        sub.metadata?.['plan'] ?? null,
        status,
        stripeDate(sub.trial_end),
        stripeDate(sub.current_period_start),
        stripeDate(sub.current_period_end),
        sub.cancel_at_period_end === true,
      ],
    ) as Array<{ tenant_id: string }>;
    return result.length > 0;
  }

  private async upsertStripeInvoice(invoice: StripeInvoice, tenantId: string | null): Promise<void> {
    if (!tenantId || !this.ds) return;
    await this.ds.query(
      `INSERT INTO invoices (
         tenant_id, stripe_invoice_id, numero, type, status, amount_due, amount_paid, currency,
         valor, due_date, hosted_invoice_url, invoice_pdf, attempt_count, metadata, created_by
       )
       VALUES ($1, $2, $2, 'stripe_subscription', COALESCE($3, 'open'), $4, $5, $6, ($4::numeric / 100.0),
               $7, $8, $9, $10, $11::jsonb, 'stripe:webhook')
       ON CONFLICT (stripe_invoice_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         amount_due = EXCLUDED.amount_due,
         amount_paid = EXCLUDED.amount_paid,
         currency = EXCLUDED.currency,
         valor = EXCLUDED.valor,
         due_date = EXCLUDED.due_date,
         hosted_invoice_url = EXCLUDED.hosted_invoice_url,
         invoice_pdf = EXCLUDED.invoice_pdf,
         attempt_count = EXCLUDED.attempt_count,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [
        tenantId,
        invoice.id,
        invoice.status ?? null,
        invoice.amount_due ?? 0,
        invoice.amount_paid ?? 0,
        invoice.currency ?? 'brl',
        stripeDate(invoice.due_date),
        invoice.hosted_invoice_url ?? null,
        invoice.invoice_pdf ?? null,
        invoice.attempt_count ?? 0,
        JSON.stringify({ stripe: invoice }),
      ],
    );
  }

  private async resolveTenantIdFromEvent(event: StripeWebhookEvent): Promise<string | null> {
    const object = event.data.object as Record<string, unknown>;
    const metadata = object['metadata'] && typeof object['metadata'] === 'object'
      ? object['metadata'] as Record<string, string>
      : {};
    const customerId = typeof object['customer'] === 'string' ? object['customer'] : null;
    const subscriptionId =
      typeof object['subscription'] === 'string' ? object['subscription'] :
      typeof object['id'] === 'string' && event.type.startsWith('customer.subscription.') ? object['id'] as string : null;
    return this.enforcement.findTenantIdByStripe({
      tenantId: metadata['tenant_id'] ?? null,
      customerId,
      subscriptionId,
    });
  }

  private async resolveTenantIdFromInvoice(invoice: StripeInvoice): Promise<string | null> {
    return this.enforcement.findTenantIdByStripe({
      tenantId: invoice.metadata?.['tenant_id'] ?? null,
      customerId: invoice.customer,
      subscriptionId: invoice.subscription ?? null,
    });
  }

  private async resolveOrgIdForTenant(tenantId: string | null): Promise<string | null> {
    if (!tenantId || !this.ds) return null;
    const rows = await this.ds.query(
      `SELECT org_id FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    ) as Array<{ org_id: string }>;
    return rows[0]?.org_id ?? null;
  }

  private async recordLegacyWebhook(
    event: StripeWebhookEvent,
    tenantId: string | null,
    status: WebhookEventStatus,
    error?: string,
  ): Promise<void> {
    if (!this.webhookRepo) return;
    const existing = await this.webhookRepo
      .createQueryBuilder('w')
      .where('w.external_id = :externalId', { externalId: event.id })
      .getOne();
    if (!existing) {
      await this.webhookRepo.save(this.webhookRepo.create({
        tenant_id: tenantId,
        provider: 'stripe',
        event_type: event.type,
        external_id: event.id,
        payload: event as unknown as Record<string, unknown>,
        status,
        processed_at: status === WebhookEventStatus.PROCESSED ? new Date() : null,
        error: error ?? null,
      }));
      return;
    }
    await this.webhookRepo
      .createQueryBuilder()
      .update(WebhookEventEntity)
      .set({
        tenant_id: tenantId,
        status,
        processed_at: status === WebhookEventStatus.PROCESSED ? new Date() : existing.processed_at,
        error: error ?? null,
        retry_count: status === WebhookEventStatus.FAILED ? (existing.retry_count ?? 0) + 1 : existing.retry_count,
      } as any)
      .where('external_id = :externalId', { externalId: event.id })
      .execute();
  }

  async getSubscription(orgId: string) {
    this.assertBillingRepositories();
    const sub = await this.subRepo!
      .createQueryBuilder('s')
      .where('s.org_id = :orgId', { orgId })
      .getOne();
    if (!sub) return null;
    if (!sub.tenant_id) return sub;
    // find-d45d822d: `getState()` is now a pure read — `/billing` routes are
    // on BillingEnforcementGuard's always-allowed list, so this call is the
    // ONLY point that can trigger escalation for a tenant who exclusively
    // visits the billing page and never hits any other enforced route.
    const state = sub.tenant_id ? await this.enforcement.getStateWithEscalation(sub.tenant_id) : null;
    const invoiceRows = sub.tenant_id && this.ds
      ? await this.ds.query(
          `SELECT stripe_invoice_id, amount_due, amount_paid, currency, status, due_date, hosted_invoice_url, invoice_pdf, attempt_count
             FROM invoices
            WHERE tenant_id = $1 AND stripe_invoice_id IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1`,
          [sub.tenant_id],
        ) as Record<string, unknown>[]
      : [];
    return { ...sub, billing_state: state, latest_invoice: invoiceRows[0] ?? null };
  }

  async getUsage(tenantId: string, orgId: string) {
    this.assertBillingRepositories();
    const sub = await this.getSubscription(orgId);
    const plan = ((sub as any)?.plan ?? 'starter') as string;
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
    // find-d45d822d: see getSubscription — `/billing` bypasses the guard's
    // escalating read, so this must stay the escalating variant too.
    const billingState = await this.enforcement.getStateWithEscalation(tenantId);
    return { plan, limits, tenantId, orgId, billingState };
  }

  async getSaasMetrics() {
    this.assertBillingRepositories();
    const rows = await this.ds!.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')::int AS active_subscriptions,
         COUNT(*) FILTER (WHERE status = 'past_due')::int AS past_due_subscriptions,
         COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_subscriptions
       FROM billing_subscriptions`,
    ) as Array<Record<string, number>>;
    return rows[0] ?? { active_subscriptions: 0, past_due_subscriptions: 0, cancelled_subscriptions: 0 };
  }
}
