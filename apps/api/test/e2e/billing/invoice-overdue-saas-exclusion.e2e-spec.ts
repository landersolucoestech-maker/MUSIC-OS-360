/**
 * test/e2e/billing/invoice-overdue-saas-exclusion.e2e-spec.ts
 *
 * Gotcha #4/#5 — the two dunning systems meet in the dual-purpose `invoices`
 * table. InvoiceOverdueScheduler (tenant-invoice dunning) must never process
 * the tenant's own Stripe SaaS subscription invoices (type
 * 'stripe_subscription', dunned by BillingEnforcementService). Real Postgres,
 * production wiring (app role + tenant context, owner as ADMIN_DATA_SOURCE).
 * The SaaS row is given a past data_vencimento on purpose: before the explicit
 * type filter it was excluded only because Stripe rows never set that column.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../../../src/database/entities';
import { makeTenantAwareDataSource } from '../../../src/database/tenant-als';
import { DatabaseContextService } from '../../../src/database/database-context.service';
import { InvoiceOverdueScheduler } from '../../../src/modules/invoices/schedulers/invoice-overdue.scheduler';

function env(key: string): string {
  const p = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

describe('InvoiceOverdueScheduler excludes Stripe SaaS invoices (real Postgres)', () => {
  let owner: DataSource;
  let appReal: DataSource;
  const tenantId = randomUUID();
  const taxInvoice = randomUUID();
  const saasInvoice = randomUUID();

  beforeAll(async () => {
    owner = await new DataSource({ type: 'postgres', url: env('DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    appReal = await new DataSource({ type: 'postgres', url: env('APP_DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    await owner.query(`INSERT INTO tenants (id, org_id, name, slug) VALUES ($1, gen_random_uuid(), 'Overdue E2E', $2)`, [tenantId, `overdue-e2e-${tenantId.slice(0, 8)}`]);
    const past = new Date(Date.now() - 5 * 86400_000);
    await owner.query(
      `INSERT INTO invoices (id, tenant_id, type, status, legacy_amount, data_vencimento, metadata)
       VALUES ($1, $3, 'nfse', 'pending', 100, $4, '{}'::jsonb),
              ($2, $3, 'stripe_subscription', 'pending', 99, $4, '{}'::jsonb)`,
      [taxInvoice, saasInvoice, tenantId, past],
    );
  }, 30000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await owner.query(`DELETE FROM invoices WHERE tenant_id = $1`, [tenantId]);
      await owner.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
      await owner.destroy();
    }
    if (appReal?.isInitialized) await appReal.destroy();
  });

  it('marks only the tenant tax invoice overdue and emits only for it', async () => {
    const app = makeTenantAwareDataSource(appReal);
    const dbContext = new DatabaseContextService(app, { get: () => 'true' } as never);
    const emitted: Array<{ type: string; id: unknown }> = [];
    const events = { emitTyped: (type: string, e: { aggregateId: unknown }) => emitted.push({ type, id: e.aggregateId }) };
    const scheduler = new InvoiceOverdueScheduler(app, events as never, dbContext, owner);

    await scheduler.runCheck();

    const rows = await owner.query(`SELECT id, status FROM invoices WHERE tenant_id = $1`, [tenantId]);
    const byId = Object.fromEntries(rows.map((r: { id: string; status: string }) => [r.id, r.status]));
    expect(byId[taxInvoice]).toBe('overdue');
    expect(byId[saasInvoice]).toBe('pending');
    const ours = emitted.filter((e) => e.id === taxInvoice || e.id === saasInvoice);
    expect(ours.map((e) => e.id)).toEqual([taxInvoice]);
  });
});
