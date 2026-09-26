/**
 * test/e2e/integrations/public-path-tenant-context.e2e-spec.ts  ·  find-b4201eb2
 *
 * Classe de defeito: leitura/escrita tenant-scoped a partir de caminhos SEM
 * contexto de tenant (rota @Public, callback OAuth, scheduler). Prova contra
 * PostgreSQL REAL (role musicos_app NOBYPASSRLS, FORCE RLS), usando a MESMA
 * maquinaria de produção (makeTenantAwareDataSource + DatabaseContextService):
 *
 *  1. escrita de token OAuth sem contexto é NEGADA pelo RLS (causa raiz do
 *     callback Spotify GET e do oauth/exchange);
 *  2. a mesma escrita dentro de runInTenantContext / ensureTenantContext
 *     persiste para o tenant certo;
 *  3. ensureTenantContext reusa um contexto já ativo (não abre transação
 *     paralela);
 *  4. InstagramTokenRefreshScheduler enumera via ADMIN_DATA_SOURCE e renova
 *     cada conexão dentro do contexto do seu tenant (antes: 0 linhas vistas).
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

const TENANT_A = '7c000000-0000-4000-8000-00000000000a';
const TENANT_B = '7d000000-0000-4000-8000-00000000000b';

function env(key: string): string {
  const p = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

describe('Caminhos públicos/sistema com contexto de tenant — Postgres real (find-b4201eb2)', () => {
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

  it('1. causa raiz: gravar token OAuth sem contexto é negado pelo RLS', async () => {
    await expect(save(TENANT_A, 'spotify')).rejects.toThrow(/row-level security/);
  });

  it('2. dentro de runInTenantContext grava para o tenant certo', async () => {
    await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, () => save(TENANT_A, 'spotify'));
    const rows = await owner.query(`SELECT tenant_id FROM oauth_connections WHERE provider = 'spotify' AND tenant_id = ANY($1)`, [[TENANT_A, TENANT_B]]);
    expect(rows).toEqual([{ tenant_id: TENANT_A }]);
  });

  it('2b. contexto de OUTRO tenant não permite gravar para A (fail-closed)', async () => {
    await expect(
      dbContext.runInTenantContext({ tenantId: TENANT_B, orgId: null, role: null }, () => save(TENANT_A, 'tiktok_business')),
    ).rejects.toThrow(/row-level security/);
  });

  it('3. ensureTenantContext abre contexto quando ausente e reusa quando presente', async () => {
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

  it('4. InstagramTokenRefreshScheduler enumera via admin e renova dentro do contexto de cada tenant', async () => {
    await owner.query(`DELETE FROM oauth_connections WHERE tenant_id = ANY($1)`, [[TENANT_A, TENANT_B]]);
    for (const tid of [TENANT_A, TENANT_B]) {
      await owner.query(
        `INSERT INTO oauth_connections (tenant_id, user_id, provider, access_token_encrypted, expires_at)
         VALUES ($1, 'u-e2e', 'instagram', 'x', now() + interval '2 days')`,
        [tid],
      );
    }
    // Sem admin: a conexão de app (RLS) enxerga 0 — era o comportamento em produção.
    const before = new InstagramTokenRefreshScheduler(app, { refreshLongLivedToken: jest.fn() } as never, null, dbContext);
    const beforeResult = await before.runCheck();
    expect(beforeResult.checked).toBe(0);

    const calls: Array<{ tenantId: string; hadContext: boolean; visible: number }> = [];
    const instagram = {
      refreshLongLivedToken: jest.fn(async (tenantId: string) => {
        // dentro do contexto, a conexão de app enxerga só as linhas do próprio tenant
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
});
