/**
 * test/e2e/uploads/uploads-download-tenant.e2e-spec.ts · find-df79ea88
 *
 * The web app now opens every stored document through
 * GET /uploads/:fileId/download (signed, 1h) and previews through /raw
 * instead of the permanent public bucket URL. Proves on REAL Postgres (app
 * role, NOBYPASSRLS, tenant context as the request interceptor sets it) that
 * this path is tenant-scoped: tenant B cannot obtain a signed URL for tenant
 * A's fileId, even knowing it from a leaked public link.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../../../src/database/entities';
import { makeTenantAwareDataSource } from '../../../src/database/tenant-als';
import { DatabaseContextService } from '../../../src/database/database-context.service';
import { UploadsController } from '../../../src/modules/uploads/uploads.controller';

function env(key: string): string {
  const p = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

describe('GET /uploads/:fileId/download is tenant-scoped (real Postgres, app role)', () => {
  let owner: DataSource;
  let appReal: DataSource;
  let dbContext: DatabaseContextService;
  let controller: UploadsController;
  const signedFor: string[] = [];
  const orgs = [randomUUID(), randomUUID()];
  const tenants = [randomUUID(), randomUUID()];
  const fileA = randomUUID();
  const keyA = `tenants/${tenants[0]}/documents/${fileA}/contrato.pdf`;

  beforeAll(async () => {
    owner = await new DataSource({ type: 'postgres', url: env('DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    appReal = await new DataSource({ type: 'postgres', url: env('APP_DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    const app = makeTenantAwareDataSource(appReal);
    dbContext = new DatabaseContextService(app, { get: () => 'true' } as never, owner);
    const storage = { createDownloadUrl: async (key: string) => { signedFor.push(key); return `https://signed.example/${key}?sig=1`; } };
    controller = new UploadsController(app, storage as never, { emitTyped: () => undefined } as never, {} as never);
    for (let i = 0; i < 2; i++) {
      await owner.query(
        `INSERT INTO organizations (id, name, slug, plan, billing_status, industry, address, config, metadata)
         VALUES ($1, 'Upl E2E Org', $2, 'starter', 'active', 'record_label', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
        [orgs[i], `upl-e2e-${orgs[i].slice(0, 8)}`],
      );
      await owner.query(
        `INSERT INTO tenants (id, org_id, name, slug, plan, features, settings, active)
         VALUES ($1, $2, 'Upl E2E Tenant', $3, 'starter', '{}'::jsonb, '{}'::jsonb, true)`,
        [tenants[i], orgs[i], `upl-e2e-t-${tenants[i].slice(0, 8)}`],
      );
    }
    await owner.query(
      `INSERT INTO uploads (tenant_id, user_id, file_id, original_name, mime_type, size_bytes, r2_key, category, status)
       VALUES ($1, 'user-a', $2, 'contrato.pdf', 'application/pdf', 10, $3, 'documents', 'confirmed')`,
      [tenants[0], fileA, keyA],
    );
  }, 60000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      for (const t of tenants) {
        await owner.query(`DELETE FROM uploads WHERE tenant_id = $1`, [t]).catch(() => undefined);
        await owner.query(`DELETE FROM tenants WHERE id = $1`, [t]).catch(() => undefined);
      }
      for (const o of orgs) await owner.query(`DELETE FROM organizations WHERE id = $1`, [o]).catch(() => undefined);
      await owner.destroy();
    }
    if (appReal?.isInitialized) await appReal.destroy();
  });

  const inTenant = <T>(tenantId: string, fn: () => Promise<T>) =>
    dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, () => fn());

  it('owner tenant gets a signed URL for its own file', async () => {
    const res = await inTenant(tenants[0], () => controller.download({ id: tenants[0] }, fileA));
    expect(res).toEqual({ url: `https://signed.example/${keyA}?sig=1`, expiresIn: 3600 });
  });

  it('another tenant knowing the fileId gets 404 and no signed URL is minted', async () => {
    const before = signedFor.length;
    await expect(inTenant(tenants[1], () => controller.download({ id: tenants[1] }, fileA)))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(signedFor.length).toBe(before);
  });

  it('a forged tenant param cannot cross RLS: context B asking as A sees no row', async () => {
    await expect(inTenant(tenants[1], () => controller.download({ id: tenants[0] }, fileA)))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
