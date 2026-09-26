/**
 * test/e2e/integrations/public-path-tenant-context.e2e-spec.ts  ·  find-b4201eb2
 *
 * Defect class: tenant-scoped read/write from paths WITHOUT tenant context
 * (@Public route, OAuth callback, scheduler). Proof against REAL PostgreSQL
 * (musicos_app role NOBYPASSRLS, FORCE RLS), using the SAME production
 * machinery (makeTenantAwareDataSource + DatabaseContextService):
 *
 *  1. writing an OAuth token without context is DENIED by RLS (root cause of
 *     the Spotify GET callback and oauth/exchange);
 *  2. the same write inside runInTenantContext / ensureTenantContext
 *     persists for the correct tenant;
 *  3. ensureTenantContext reuses an already-active context (does not open a
 *     parallel transaction);
 *  4. InstagramTokenRefreshScheduler enumerates via ADMIN_DATA_SOURCE and
 *     refreshes each connection inside its own tenant's context (before: 0
 *     rows seen).
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../../../src/database/entities';
import { makeTenantAwareDataSource, currentTenantManager } from '../../../src/database/tenant-als';
import { DatabaseContextService } from '../../../src/database/database-context.service';
import { EncryptionService } from '../../../src/core/security/encryption.service';
import { IntegrationBaseService } from '../../../src/modules/integrations/integration-base.service';
import { InstagramTokenRefreshScheduler } from '../../../src/modules/integrations/instagram/instagram-token-refresh.scheduler';
import { RealtimeService } from '../../../src/core/realtime/realtime.service';

const TENANT_A = '7c000000-0000-4000-8000-00000000000a';
const TENANT_B = '7d000000-0000-4000-8000-00000000000b';

function env(key: string): string {
  const p = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

describe('Public/system paths with tenant context — real Postgres (find-b4201eb2)', () => {
  let owner: DataSource;
  let appReal: DataSource;
  let app: DataSource;
  let dbContext: DatabaseContextService;
  let base: IntegrationBaseService;

  beforeAll(async () => {
    owner = await new DataSource({ type: 'postgres', url: env('DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    appReal = await new DataSource({ type: 'postgres', url: env('APP_DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    app = makeTenantAwareDataSource(appReal);
    dbContext = new DatabaseContextService(app, { get: () => 'true' } as never);
    base = new IntegrationBaseService(app, new EncryptionService({ get: () => env('ENCRYPTION_KEY') } as never));
    for (const [tid, slug] of [[TENANT_A, 'e2e-ctx-a'], [TENANT_B, 'e2e-ctx-b']]) {
      await owner.query(
        `INSERT INTO tenants (id, org_id, name, slug) VALUES ($1, gen_random_uuid(), $2, $3) ON CONFLICT (id) DO NOTHING`,
        [tid, `E2E ctx ${slug}`, slug],
      );
    }
    await owner.query(`DELETE FROM oauth_connections WHERE tenant_id = ANY($1)`, [[TENANT_A, TENANT_B]]);
  }, 30000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await owner.query(`DELETE FROM oauth_connections WHERE tenant_id = ANY($1)`, [[TENANT_A, TENANT_B]]);
      await owner.query(`DELETE FROM tenants WHERE id = ANY($1)`, [[TENANT_A, TENANT_B]]);
      await owner.destroy();
    }
    if (appReal?.isInitialized) await appReal.destroy();
  });

  const save = (tenantId: string, provider: string) => base.saveOAuthTokens({
    tenantId, userId: 'u-e2e', provider, accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600,
  });

  it('1. root cause: writing an OAuth token without context is denied by RLS', async () => {
    await expect(save(TENANT_A, 'spotify')).rejects.toThrow(/row-level security/);
  });

  it('2. inside runInTenantContext writes for the correct tenant', async () => {
    await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, () => save(TENANT_A, 'spotify'));
    const rows = await owner.query(`SELECT tenant_id FROM oauth_connections WHERE provider = 'spotify' AND tenant_id = ANY($1)`, [[TENANT_A, TENANT_B]]);
    expect(rows).toEqual([{ tenant_id: TENANT_A }]);
  });

  it('2b. another tenant\'s context does not allow writing for A (fail-closed)', async () => {
    await expect(
      dbContext.runInTenantContext({ tenantId: TENANT_B, orgId: null, role: null }, () => save(TENANT_A, 'tiktok_business')),
    ).rejects.toThrow(/row-level security/);
  });

  it('3. ensureTenantContext opens context when absent and reuses it when present', async () => {
    let managersSeen: unknown[] = [];
    await dbContext.ensureTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
      managersSeen.push(currentTenantManager());
    });
    expect(managersSeen[0]).toBeTruthy();

    managersSeen = [];
    await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
      const outer = currentTenantManager();
      await dbContext.ensureTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
        managersSeen.push(outer, currentTenantManager());
      });
    });
    expect(managersSeen[0]).toBe(managersSeen[1]);
  });

  it('4. InstagramTokenRefreshScheduler enumerates via admin and refreshes inside each tenant\'s context', async () => {
    await owner.query(`DELETE FROM oauth_connections WHERE tenant_id = ANY($1)`, [[TENANT_A, TENANT_B]]);
    for (const tid of [TENANT_A, TENANT_B]) {
      await owner.query(
        `INSERT INTO oauth_connections (tenant_id, user_id, provider, access_token_encrypted, expires_at)
         VALUES ($1, 'u-e2e', 'instagram', 'x', now() + interval '2 days')`,
        [tid],
      );
    }
    // Without admin: the app connection (RLS) sees 0 — this was the production behavior.
    const before = new InstagramTokenRefreshScheduler(app, { refreshLongLivedToken: jest.fn() } as never, null, dbContext);
    const beforeResult = await before.runCheck();
    expect(beforeResult.checked).toBe(0);

    const calls: Array<{ tenantId: string; hadContext: boolean; visible: number }> = [];
    const instagram = {
      refreshLongLivedToken: jest.fn(async (tenantId: string) => {
        // inside the context, the app connection sees only its own tenant's rows
        const visible = await app.query(`SELECT count(*)::int AS n FROM oauth_connections WHERE provider = 'instagram'`);
        calls.push({ tenantId, hadContext: currentTenantManager() != null, visible: visible[0].n });
        return true;
      }),
    };
    const scheduler = new InstagramTokenRefreshScheduler(app, instagram as never, owner, dbContext);
    const result = await scheduler.runCheck();
    const ours = calls.filter((c) => c.tenantId === TENANT_A || c.tenantId === TENANT_B);
    expect(ours.map((c) => c.tenantId).sort()).toEqual([TENANT_A, TENANT_B].sort());
    for (const c of ours) {
      expect(c.hadContext).toBe(true);
      expect(c.visible).toBe(1);
    }
    expect(result.refreshed).toBeGreaterThanOrEqual(2);
  });

  it('5. context with only tenantId completes the org (org-isolated tables: tenants/organizations/billing_subscriptions)', async () => {
    const readOwnTenant = () => app.query(`SELECT count(*)::int AS n FROM tenants WHERE id = $1`, [TENANT_A]);
    const readOtherTenant = () => app.query(`SELECT count(*)::int AS n FROM tenants WHERE id = $1`, [TENANT_B]);

    // Without ADMIN_DATA_SOURCE (old behavior): empty org -> 0 rows.
    const noAdmin = new DatabaseContextService(app, { get: () => 'true' } as never);
    const before = await noAdmin.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, readOwnTenant);
    expect(before[0].n).toBe(0);

    // With ADMIN_DATA_SOURCE: org resolved from the tenant.
    const withAdmin = new DatabaseContextService(app, { get: () => 'true' } as never, owner);
    const own = await withAdmin.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, readOwnTenant);
    expect(own[0].n).toBe(1);
    // ...and still does not see the tenant from ANOTHER org.
    const other = await withAdmin.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, readOtherTenant);
    expect(other[0].n).toBe(0);
  });

  it('6. RealtimeService resolves tenant -> org outside context (before: broadcast always skipped)', async () => {
    const expected = (await owner.query(`SELECT org_id FROM tenants WHERE id = $1`, [TENANT_A]))[0].org_id;
    const cfg = { get: () => undefined } as never;
    const legacy = new RealtimeService(cfg, app) as unknown as { resolveOrgId(t: string): Promise<string | null> };
    expect(await legacy.resolveOrgId(TENANT_A)).toBeNull();
    const fixed = new RealtimeService(cfg, app, owner) as unknown as { resolveOrgId(t: string): Promise<string | null> };
    expect(await fixed.resolveOrgId(TENANT_A)).toBe(expected);
  });
});
