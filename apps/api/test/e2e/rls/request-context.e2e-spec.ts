/**
 * test/e2e/rls/request-context.e2e-spec.ts  ·  PHASE 3J
 *
 * Proves, against REAL PostgreSQL (musicos_app role, RLS+FORCE), that the
 * request-path context mechanism fixes the finding from PHASE 3I:
 *
 *  - a repository CAPTURED in the constructor (before any context), as
 *    services do (`this.repo = ds.getRepository(X)`), now runs inside the
 *    tenant context when the operation happens inside runInTenantContext;
 *  - private_get_tenant_id() returns the correct tenant;
 *  - cross-tenant isolation is guaranteed by RLS (not by the app-layer filter).
 *
 * Reuses the SAME production code: makeTenantAwareDataSource + DatabaseContextService.
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
        'record_label',
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
      `Failed to create E2E tenants: expected 2, found ${rows.length}`,
    );
  }
}

describe('PHASE 3J — transparent tenant context in the request-path (real PostgreSQL)', () => {
  let owner: DataSource;
  let appReal: DataSource;
  let appProxied: DataSource;
  let dbContext: DatabaseContextService;
  // Captured ONCE, outside any context — exactly like the services do.
  let conversationRepoCapturedAtConstruction: Repository<ConversationEntity>;
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
    // ↓↓↓ captured in the "constructor" (no active context) — the point that broke in 3I
    conversationRepoCapturedAtConstruction = appProxied.getRepository(ConversationEntity);

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

  it('WITHOUT context (bug 3I reproduced): captured repo sees 0 rows in conversations FORCE-RLS', async () => {
    const rows = await conversationRepoCapturedAtConstruction.find({ where: { subject: tagA as never } });
    expect(rows.length).toBe(0); // private_get_tenant_id() = NULL → deny
  });

  it('WITH context (Tenant A): private_get_tenant_id()=A and the SAME repo sees only A', async () => {
    await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
      const pid = (await appProxied.query(`SELECT private_get_tenant_id() p`))[0].p;
      expect(pid).toBe(TENANT_A);

      const a = await conversationRepoCapturedAtConstruction.find({ where: { subject: tagA as never } });
      const b = await conversationRepoCapturedAtConstruction.find({ where: { subject: tagB as never } });
      expect(a.length).toBe(1);   // sees A
      expect(b.length).toBe(0);   // does NOT see B (RLS isolation)
    });
  });

  it('WITH context (Tenant B): the SAME repo sees only B', async () => {
    await dbContext.runInTenantContext({ tenantId: TENANT_B, orgId: null, role: null }, async () => {
      const a = await conversationRepoCapturedAtConstruction.find({ where: { subject: tagA as never } });
      const b = await conversationRepoCapturedAtConstruction.find({ where: { subject: tagB as never } });
      expect(a.length).toBe(0);
      expect(b.length).toBe(1);
    });
  });

  it('INSERT/SELECT in context A: valid passes; cross-tenant (tenant B) is blocked (42501)', async () => {
    // Valid INSERT (there's no rollback at the end of the context — runInTenantContext commits;
    // that's why we use a subject with TAG and clean up in afterAll).
    await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
      const saved = await conversationRepoCapturedAtConstruction.save(
        conversationRepoCapturedAtConstruction.create({
          tenant_id: TENANT_A, subject: `${TAG}_INS_A`, status: 'pending' as never, channel: 'whatsapp' as never,
        }),
      );
      expect(saved.id).toBeTruthy();
    });
    // confirms persisted via OWNER
    const persisted = await owner.query(`SELECT count(*)::int n FROM conversations WHERE subject=$1`, [`${TAG}_INS_A`]);
    expect(persisted[0].n).toBe(1);

    // cross-tenant: context A, tenant_id B → WITH CHECK rejects
    let code = '';
    try {
      await dbContext.runInTenantContext({ tenantId: TENANT_A, orgId: null, role: null }, async () => {
        await conversationRepoCapturedAtConstruction.save(
          conversationRepoCapturedAtConstruction.create({
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
    expect(leaked[0].n).toBe(0); // nothing leaked
  });

  it('outside the context again: private_get_tenant_id() goes back to NULL (no leakage between operations)', async () => {
    // Null-safe: the function uses NULLIF(current_setting(...),'') → NULL when there is
    // no context, even after the custom GUC was reset to '' by a previous tx.
    const pid = (await appProxied.query(`SELECT private_get_tenant_id() p`))[0].p;
    expect(pid).toBeNull();
  });
});
