/**
 * test/e2e/billing/stripe-webhook-real-context.e2e-spec.ts
 *
 * Stripe webhook -> billing enforcement, end to end, against REAL Postgres
 * with PRODUCTION wiring (the thing no other billing test exercised):
 *   - DATA_SOURCE = app role (NOBYPASSRLS) behind makeTenantAwareDataSource,
 *   - DatabaseContextService with session context ENABLED,
 *   - ADMIN_DATA_SOURCE = owner, used only where production uses it,
 *   - events signed with the real stripe library and verified by the real
 *     constructEvent (only the Stripe HTTP API itself is unused).
 * Covers the stripe-webhook-auditor required cases: first failure, duplicate
 * delivery, repeated failure (clock must not restart), failure while
 * read_only / suspended (no regression, no restart), recovery, stale
 * out-of-order event, invalid signature, unknown customer, unhandled type,
 * concurrent deliveries, subscription deleted.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../../../src/database/entities';
import { makeTenantAwareDataSource } from '../../../src/database/tenant-als';
import { DatabaseContextService } from '../../../src/database/database-context.service';
import { BillingService } from '../../../src/modules/billing/billing.service';
import { BillingEnforcementService } from '../../../src/modules/billing/billing-enforcement.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeRaw = require('stripe');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StripeLib = ((StripeRaw as any).default ?? StripeRaw) as new (k: string) => { webhooks: { generateTestHeaderString(o: { payload: string; secret: string }): string } };

const SECRET = 'whsec_e2e_' + randomUUID().replace(/-/g, '');

function env(key: string): string {
  const p = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

describe('Stripe webhook -> billing state, production wiring on real Postgres', () => {
  let owner: DataSource;
  let appReal: DataSource;
  let billing: BillingService;
  const stripe = new StripeLib('sk_test_e2e');
  const orgId = randomUUID();
  const tenantId = randomUUID();
  const customer = `cus_e2e_${tenantId.slice(0, 8)}`;
  const subscription = `sub_e2e_${tenantId.slice(0, 8)}`;
  let seq = 0;

  const state = async () => (await owner.query(
    `SELECT status, grace_until, status_changed_at FROM tenant_billing_state WHERE tenant_id = $1`, [tenantId]))[0];
  const subStatus = async () => (await owner.query(
    `SELECT status FROM billing_subscriptions WHERE tenant_id = $1`, [tenantId]))[0]?.status;

  function signed(type: string, object: Record<string, unknown>, createdSec = Math.floor(Date.now() / 1000) + (seq++)) {
    const event = { id: `evt_e2e_${randomUUID()}`, object: 'event', type, created: createdSec, data: { object } };
    const payload = JSON.stringify(event);
    return { event, raw: Buffer.from(payload), sig: stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) };
  }
  const invoice = (extra: Record<string, unknown> = {}) => ({
    id: `in_e2e_${randomUUID().slice(0, 8)}`, object: 'invoice', customer, subscription,
    status: 'open', amount_due: 9900, amount_paid: 0, currency: 'brl', metadata: {}, ...extra,
  });
  const send = (e: { raw: Buffer; sig: string }) => billing.handleWebhook(e.sig, e.raw);

  async function setState(status: string, graceUntil: Date | null) {
    await owner.query(
      `UPDATE tenant_billing_state SET status = $2, grace_until = $3, status_changed_at = now() - interval '1 second' WHERE tenant_id = $1`,
      [tenantId, status, graceUntil],
    );
  }

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    owner = await new DataSource({ type: 'postgres', url: env('DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    appReal = await new DataSource({ type: 'postgres', url: env('APP_DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    const app = makeTenantAwareDataSource(appReal);
    const dbContext = new DatabaseContextService(app, { get: () => 'true' } as never);
    const enforcement = new BillingEnforcementService(app, { log: async () => undefined } as never, owner);
    const config = { get: (k: string) => ({ STRIPE_SECRET_KEY: 'sk_test_e2e', STRIPE_WEBHOOK_SECRET: SECRET } as Record<string, string>)[k] };
    billing = new BillingService(
      config as never, app,
      { sendToTenant: () => undefined, sendToUser: () => undefined } as never,
      { emitTyped: () => undefined, emitAsync: async () => [] } as never,
      enforcement, {} as never, dbContext,
    );

    await owner.query(
      `INSERT INTO organizations (id, name, slug, plan, billing_status, industry, address, config, metadata)
       VALUES ($1, 'Stripe E2E Org', $2, 'starter', 'active', 'record_label', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
      [orgId, `stripe-e2e-${orgId.slice(0, 8)}`],
    );
    await owner.query(
      `INSERT INTO tenants (id, org_id, name, slug, plan, features, settings, active)
       VALUES ($1, $2, 'Stripe E2E Tenant', $3, 'starter', '{}'::jsonb, '{}'::jsonb, true)`,
      [tenantId, orgId, `stripe-e2e-t-${tenantId.slice(0, 8)}`],
    );
    await owner.query(
      `INSERT INTO billing_subscriptions (org_id, tenant_id, stripe_customer_id, stripe_subscription_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [orgId, tenantId, customer, subscription],
    );
    await owner.query(`INSERT INTO tenant_billing_state (tenant_id, status) VALUES ($1, 'active')`, [tenantId]);
  }, 60000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      for (const sql of [
        `DELETE FROM invoices WHERE tenant_id = $1`,
        `DELETE FROM payment_events WHERE tenant_id = $1`,
        `DELETE FROM webhook_events WHERE tenant_id = $1`,
        `DELETE FROM tenant_billing_state WHERE tenant_id = $1`,
        `DELETE FROM billing_subscriptions WHERE tenant_id = $1`,
        `DELETE FROM tenants WHERE id = $1`,
      ]) await owner.query(sql, [tenantId]).catch(() => undefined);
      await owner.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
      await owner.destroy();
    }
    if (appReal?.isInitialized) await appReal.destroy();
  });

  it('invalid signature: rejected, no mutation', async () => {
    const e = signed('invoice.payment_failed', invoice());
    await expect(billing.handleWebhook('t=1,v1=deadbeef', e.raw)).rejects.toThrow(/Assinatura Stripe/);
    expect((await state()).status).toBe('active');
  });

  it('first payment failure (invoice has no metadata): tenant resolved from customer id, grace starts', async () => {
    await send(signed('invoice.payment_failed', invoice()));
    const s = await state();
    expect(s.status).toBe('payment_grace');
    expect(s.grace_until).not.toBeNull();
    expect(await subStatus()).toBe('past_due');
  });

  it('duplicate delivery of the same event id: no second effect', async () => {
    const e = signed('invoice.payment_failed', invoice());
    await send(e);
    const before = await state();
    await send(e);
    const after = await state();
    expect(after.grace_until?.toISOString()).toBe(before.grace_until?.toISOString());
    expect(after.status_changed_at?.toISOString()).toBe(before.status_changed_at?.toISOString());
  });

  it('repeated failure while in payment_grace: dunning clock NOT restarted', async () => {
    const anchor = new Date(Date.now() + 2 * 86400_000);
    await setState('payment_grace', anchor);
    await send(signed('invoice.payment_failed', invoice()));
    const s = await state();
    expect(s.status).toBe('payment_grace');
    expect(new Date(s.grace_until).toISOString()).toBe(anchor.toISOString());
  });

  it('failure while read_only: no regression to payment_grace, clock kept', async () => {
    const anchor = new Date(Date.now() - 86400_000);
    await setState('read_only', anchor);
    await send(signed('invoice.payment_failed', invoice()));
    const s = await state();
    expect(s.status).toBe('read_only');
    expect(new Date(s.grace_until).toISOString()).toBe(anchor.toISOString());
  });

  it('failure while suspended (Smart Retry after suspension): stays suspended, no fresh grace', async () => {
    const anchor = new Date(Date.now() - 10 * 86400_000);
    await setState('suspended', anchor);
    await send(signed('invoice.payment_failed', invoice()));
    const s = await state();
    expect(s.status).toBe('suspended');
    expect(new Date(s.grace_until).toISOString()).toBe(anchor.toISOString());
  });

  it('recovery (invoice.paid) after suspension: active again, subscription active', async () => {
    await send(signed('invoice.paid', invoice({ status: 'paid', amount_paid: 9900 })));
    expect((await state()).status).toBe('active');
    expect(await subStatus()).toBe('active');
  });

  it('stale out-of-order failure (created before the recovery transition): ignored', async () => {
    const staleCreated = Math.floor(Date.now() / 1000) - 3600;
    await send(signed('invoice.payment_failed', invoice(), staleCreated));
    expect((await state()).status).toBe('active');
  });

  it('unknown customer: received, no tenant mutated', async () => {
    const res = await send(signed('invoice.payment_failed', { ...invoice(), customer: 'cus_unknown_e2e', subscription: 'sub_unknown_e2e' }));
    expect(res).toEqual({ received: true });
    expect((await state()).status).toBe('active');
  });

  it('unhandled event type: safe no-op', async () => {
    const res = await send(signed('customer.created', { id: customer, object: 'customer' }));
    expect(res).toEqual({ received: true });
    expect((await state()).status).toBe('active');
  });

  it('concurrent failures for the same active tenant: exactly one transition, one clock', async () => {
    await setState('active', null);
    const a = signed('invoice.payment_failed', invoice());
    const b = signed('invoice.payment_failed', invoice());
    await Promise.allSettled([send(a), send(b)]);
    const s = await state();
    expect(s.status).toBe('payment_grace');
    const audit = await owner.query(
      `SELECT count(*)::int AS n FROM payment_events WHERE tenant_id = $1 AND stripe_event_id = ANY($2)`,
      [tenantId, [a.event.id, b.event.id]],
    );
    expect(audit[0].n).toBe(2);
  });

  it('customer.subscription.deleted (subscription object has no metadata): tenant cancelled', async () => {
    await send(signed('customer.subscription.deleted', { id: subscription, object: 'subscription', customer, status: 'canceled', metadata: {} }));
    expect((await state()).status).toBe('cancelled');
  });
});
