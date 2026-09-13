/**
 * test/e2e/billing/billing-admin-atomicity.e2e-spec.ts
 *
 * P0-A-R6 (T23) — real-Postgres rollback proof.
 *
 * `BillingService.updateAdminTenant` used to commit its `ds.transaction(...)`
 * (tenant name/slug/plan/country/owner_email writes) BEFORE dispatching
 * `body.status` to `BillingEnforcementService`, which ran as a second,
 * separate, un-transacted step. Any failure in that second step left the
 * first step's writes already committed — a partial commit.
 *
 * `billing.service.spec.ts`'s T17-T22 prove the CALL ORDER/control-flow with
 * mocks, but a mock can never prove a real ROLLBACK happened in Postgres —
 * that requires an actual transaction, an actual mid-transaction failure,
 * and an actual re-read from the database afterward. This spec is that
 * proof: it runs `updateAdminTenant` against a real Postgres connection
 * (same harness pattern as `test/e2e/rls/rls-isolation.e2e-spec.ts`), forces
 * the enforcement dispatch to throw from *inside* the transaction, and
 * asserts the tenant's `name`/`slug` column — read back from the database
 * after the call rejects, once the transaction has settled — is UNCHANGED.
 * Only the enforcement call itself is stubbed (it must throw deterministically); the
 * `DataSource`, the `ds.transaction(...)` call, and the actual writes are
 * all real.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { BillingService } from '../../../src/modules/billing/billing.service';
import { BillingEnforcementService } from '../../../src/modules/billing/billing-enforcement.service';
import { TenantEntity, ALL_ENTITIES } from '../../../src/database/entities';

function readEnv(key: string): string {
  const envPath = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  return (txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? process.env[key] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

describe('BillingService.updateAdminTenant — atomicity against real Postgres (P0-A-R6 / T23)', () => {
  let owner: DataSource;
  let orgId: string;
  let tenantId: string;
  const ORIGINAL_NAME = 'P0-A-R6 Atomicity Fixture';
  const ORIGINAL_SLUG = `p0a-r6-atomicity-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const ownerUrl = readEnv('DATABASE_URL');
    owner = await new DataSource({
      type: 'postgres',
      url: ownerUrl,
      ssl: false,
      entities: ALL_ENTITIES,
    }).initialize();

    orgId = randomUUID();
    await owner.query(
      `INSERT INTO organizations (id, name, slug, plan, billing_status, industry, address, config, metadata)
       VALUES ($1, 'P0-A-R6 E2E Org', $2, 'starter', 'trial', 'gravadora', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
      [orgId, `p0a-r6-org-${randomUUID().slice(0, 8)}`],
    );

    tenantId = randomUUID();
    await owner.query(
      `INSERT INTO tenants (id, org_id, name, slug, plan, features, settings, active)
       VALUES ($1, $2, $3, $4, 'starter', '{}'::jsonb, '{}'::jsonb, true)`,
      [tenantId, orgId, ORIGINAL_NAME, ORIGINAL_SLUG],
    );
  }, 30000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await owner.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
      await owner.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
      await owner.destroy();
    }
  });

  function buildService(enforcement: Pick<BillingEnforcementService,
    'suspendTenant' | 'activateTenant' | 'cancelTenant' | 'startPaymentGrace'>): BillingService {
    return new BillingService(
      undefined,
      owner,
      {} as never, // RealtimeService — unused by updateAdminTenant
      {} as never, // EventsService — unused by updateAdminTenant
      enforcement as BillingEnforcementService,
      {} as never, // BillingPlansService — unused by updateAdminTenant
      {} as never, // DatabaseContextService — unused by updateAdminTenant
    );
  }

  it('T23: a real transaction failure after the tenant write rolls back the tenant write in Postgres', async () => {
    const boom = new Error('T23: forced enforcement failure mid-transaction');
    const enforcement = {
      suspendTenant: jest.fn().mockRejectedValue(boom),
      activateTenant: jest.fn(),
      cancelTenant: jest.fn(),
      startPaymentGrace: jest.fn(),
    };
    const service = buildService(enforcement);

    await expect(
      service.updateAdminTenant(tenantId, {
        name: 'SHOULD NOT PERSIST — T23',
        slug: `should-not-persist-${randomUUID().slice(0, 8)}`,
        status: 'suspended',
      } as never),
    ).rejects.toThrow(boom);

    expect(enforcement.suspendTenant).toHaveBeenCalledTimes(1);

    // Re-read on the SAME connection, after the transaction settled — proves
    // Postgres itself rolled back the name/slug UPDATE, not just that the
    // in-process object was never mutated.
    const rows = await owner.query(`SELECT name, slug FROM tenants WHERE id = $1`, [tenantId]);
    expect(rows[0].name).toBe(ORIGINAL_NAME);
    expect(rows[0].slug).toBe(ORIGINAL_SLUG);
  }, 30000);

  it('control: a successful call (no forced failure) DOES persist the tenant write, proving the harness itself is valid', async () => {
    const enforcement = {
      suspendTenant: jest.fn().mockResolvedValue(undefined),
      activateTenant: jest.fn(),
      cancelTenant: jest.fn(),
      startPaymentGrace: jest.fn(),
    };
    const service = buildService(enforcement);
    const newName = `T23 Control Success ${randomUUID().slice(0, 8)}`;

    await service.updateAdminTenant(tenantId, { name: newName, status: 'suspended' } as never);

    expect(enforcement.suspendTenant).toHaveBeenCalledTimes(1);
    const rows = await owner.query(`SELECT name FROM tenants WHERE id = $1`, [tenantId]);
    expect(rows[0].name).toBe(newName);
  }, 30000);
});
