/**
 * test/e2e/rls/request-context.e2e-spec.ts  ·  FASE 3J
 *
 * Prova, contra PostgreSQL REAL (role musicos_app, RLS+FORCE), que o mecanismo
 * de contexto de request-path corrige o achado da FASE 3I:
 *
 *  - um repositório CAPTURADO no construtor (antes de qualquer contexto), como os
 *    services fazem (`this.repo = ds.getRepository(X)`), passa a rodar dentro do
 *    contexto de tenant quando a operação ocorre dentro de runInTenantContext;
 *  - private_get_tenant_id() retorna o tenant correto;
 *  - isolamento cross-tenant é garantido pelo RLS (não pelo filtro app-layer).
 *
 * Reusa o MESMO código de produção: makeTenantAwareDataSource + DatabaseContextService.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, Repository } from 'typeorm';
import { ALL_ENTITIES, ConversationEntity } from '../../../src/database/entities';
import { makeTenantAwareDataSource } from '../../../src/database/tenant-als';
import { DatabaseContextService } from '../../../src/database/database-context.service';

const TENANT_A = '10000000-0000-0000-0000-000000000002';
const TENANT_B = 'fb6f3d4f-6161-4b55-8e4f-b4443c509b7c';

function env(key: string): string {
  // An explicitly-provided process env must always win over .env.development.
  const p = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

async function ensureE2eTenants(owner: DataSource): Promise<void> {
  const organizationId = '90000000-0000-0000-0000-000000000001';

  await owner.query(
    `
      INSERT INTO organizations (
        id,
        name,
        slug,
        plan,
        billing_status,
        industry,
        address,
        config,
        metadata
      )
      VALUES (
        $1,
        'MUSIC OS 360 E2E',
        'music-os-360-e2e',
        'starter',
        'trial',
        'gravadora',
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW()
    `,
    [organizationId],
  );

  await owner.query(
    `
      INSERT INTO tenants (
        id,
        org_id,
        name,
        slug,
        plan,
        features,
        settings,
        active
      )
      VALUES
        (
          $1,
          $3,
          'MUSIC OS 360 E2E Tenant A',
          'music-os-360-e2e-tenant-a',
          'starter',
          '{}'::jsonb,
          '{}'::jsonb,
          true
        ),
        (
          $2,
          $3,
          'MUSIC OS 360 E2E Tenant B',
          'music-os-360-e2e-tenant-b',
          'starter',
          '{}'::jsonb,
          '{}'::jsonb,
          true
        )
      ON CONFLICT (id) DO UPDATE SET
        org_id = EXCLUDED.org_id,
        name = EXCLUDED.name,
        active = true,
        updated_at = NOW()
    `,
    [TENANT_A, TENANT_B, organizationId],
  );

  const rows = await owner.query(
    `
      SELECT id
      FROM tenants
      WHERE id = ANY($1::uuid[])
      ORDER BY id
    `,
    [[TENANT_A, TENANT_B]],
  );

  if (rows.length !== 2) {
    throw new Error(
      `Falha ao criar tenants E2E: esperados 2, encontrados ${rows.length}`,
    );
  }
}

describe('FASE 3J — contexto de tenant transparente no request-path (PostgreSQL real)', () => {
  let owner: DataSource;
  let appReal: DataSource;
  let appProxied: DataSource;
  let dbContext: DatabaseContextService;
  // Capturado UMA vez, fora de qualquer contexto — exatamente como os services.
  let convRepoCapturadoNoConstrutor: Repository<ConversationEntity>;
  const TAG = `RC_${Date.now()}`;
  const tagA = `${TAG}_A`;
  const tagB = `${TAG}_B`;

  beforeAll(async () => {
    owner = await new DataSource({ type: 'postgres', url: env('DATABASE_URL'), ssl: false }).initialize();
    await ensureE2eTenants(owner);
    appReal = await new DataSource({
      type: 'postgres', url: env('APP_DATABASE_URL'), ssl: false, entities: ALL_ENTITIES, synchronize: false,
    }).initialize();

    appProxied = makeTenantAwareDataSource(appReal);
    // Flag ON via ConfigService stub.
    dbContext = new DatabaseContextService(
      appProxied,
      { get: () => 'true' } as unknown as ConstructorParameters<typeof DatabaseContextService>[1],
    );
    // ↓↓↓ captura no "construtor" (sem contexto ativo) — o ponto que quebrava na 3I
    convRepoCapturadoNoConstrutor = appProxied.getRepository(ConversationEntity);

    await owner.query(
      `INSERT INTO conversations (id,tenant_id,subject,status,channel) VALUES (gen_random_uuid(),$1,$2,'pending','whatsapp')`,
      [TENANT_A, tagA]);
    await owner.query(
      `INSERT INTO conversations (id,tenant_id,subject,status,channel) VALUES (gen_random_uuid(),$1,$2,'pending','whatsapp')`,
      [TENANT_B, tagB]);
  }, 30000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await owner.query(`DELETE FROM conversations WHERE subject LIKE $1`, [`${TAG}%`]);
      await owner.destroy();
    }
    if (appReal?.isInitialized) await appReal.destroy();
  });

  it('SEM contexto (bug 3I reproduzido): repo capturado vê 0 linhas em conversations FORCE-RLS', async () => {
    const rows = await convRepoCapturadoNoConstrutor.find({ where: { subject: tagA as never } });
    expect(rows.length).toBe(0); // private_get_tenant_id() = NULL → deny
  });

  it('COM contexto (Tenant A): private_get_tenant_id()=A e o MESMO repo vê só A', async () => {
    await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
      const pid = (await appProxied.query(`SELECT private_get_tenant_id() p`))[0].p;
      expect(pid).toBe(TENANT_A);

      const a = await convRepoCapturadoNoConstrutor.find({ where: { subject: tagA as never } });
      const b = await convRepoCapturadoNoConstrutor.find({ where: { subject: tagB as never } });
      expect(a.length).toBe(1);   // vê A
      expect(b.length).toBe(0);   // NÃO vê B (isolamento por RLS)
    });
  });

  it('COM contexto (Tenant B): o MESMO repo vê só B', async () => {
    await dbContext.runInTenantContext({ tenantId: TENANT_B, orgId: null, role: null }, async () => {
      const a = await convRepoCapturadoNoConstrutor.find({ where: { subject: tagA as never } });
      const b = await convRepoCapturadoNoConstrutor.find({ where: { subject: tagB as never } });
      expect(a.length).toBe(0);
      expect(b.length).toBe(1);
    });
  });

  it('INSERT/SELECT no contexto A: válido passa; cross-tenant (tenant B) é bloqueado (42501)', async () => {
    // INSERT válido (rollback no fim do contexto não há — runInTenantContext comita;
    // por isso usamos subject com TAG e limpamos no afterAll).
    await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
      const saved = await convRepoCapturadoNoConstrutor.save(
        convRepoCapturadoNoConstrutor.create({
          tenant_id: TENANT_A, subject: `${TAG}_INS_A`, status: 'pending' as never, channel: 'whatsapp' as never,
        }),
      );
      expect(saved.id).toBeTruthy();
    });
    // confirma persistido via OWNER
    const persisted = await owner.query(`SELECT count(*)::int n FROM conversations WHERE subject=$1`, [`${TAG}_INS_A`]);
    expect(persisted[0].n).toBe(1);

    // cross-tenant: contexto A, tenant_id B → WITH CHECK rejeita
    let code = '';
    try {
      await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
        await convRepoCapturadoNoConstrutor.save(
          convRepoCapturadoNoConstrutor.create({
            tenant_id: TENANT_B, subject: `${TAG}_INS_X`, status: 'pending' as never, channel: 'whatsapp' as never,
          }),
        );
      });
    } catch (e) {
      code = (e as { driverError?: { code?: string }; code?: string }).driverError?.code
        ?? (e as { code?: string }).code ?? '';
    }
    expect(code).toBe('42501');
    const leaked = await owner.query(`SELECT count(*)::int n FROM conversations WHERE subject=$1`, [`${TAG}_INS_X`]);
    expect(leaked[0].n).toBe(0); // nada vazou
  });

  it('fora do contexto novamente: private_get_tenant_id() volta a NULL (sem vazamento entre operações)', async () => {
    // Null-safe: a função usa NULLIF(current_setting(...),'') → NULL quando não há
    // contexto, mesmo após o GUC custom ter sido resetado para '' por uma tx prévia.
    const pid = (await appProxied.query(`SELECT private_get_tenant_id() p`))[0].p;
    expect(pid).toBeNull();
  });
});
