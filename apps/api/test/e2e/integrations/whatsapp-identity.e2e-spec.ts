/**
 * test/e2e/integrations/whatsapp-identity.e2e-spec.ts  ·  find-2220a85e
 *
 * Contra PostgreSQL REAL (migrations aplicadas, role musicos_app NOBYPASSRLS +
 * FORCE RLS em `integrations`):
 *
 *  1. Documenta a causa raiz: a varredura cross-tenant feita pela conexão de
 *     aplicação SEM contexto de tenant (caminho do webhook @Public) retorna 0
 *     linhas — com o código antigo nenhuma mensagem WhatsApp inbound era
 *     roteada em produção (DATABASE_SESSION_CONTEXT_ENABLED=true).
 *  2. Prova o fix: WhatsAppCloudProvider.resolveTenantByPhoneNumberId via
 *     ADMIN_DATA_SOURCE (owner) resolve exatamente o tenant vinculado.
 *  3. Prova o fail-closed: um vínculo duplicado legado vira `conflict`.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../../../src/database/entities';
import { EncryptionService } from '../../../src/core/security/encryption.service';
import { WhatsAppCloudProvider } from '../../../src/modules/integrations/whatsapp/whatsapp-cloud.provider';

const TENANT_A = '7a000000-0000-4000-8000-00000000000a';
const TENANT_B = '7b000000-0000-4000-8000-00000000000b';
const ORG_A = '7a000000-0000-4000-8000-0000000000aa';
const ORG_B = '7b000000-0000-4000-8000-0000000000bb';
const PHONE_A = '5500000000001';
const PHONE_SHARED = '5500000000009';

function env(key: string): string {
  const p = path.resolve(process.cwd(), '.env.development');
  const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return (process.env[key] ?? txt.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim().replace(/^["']|["']$/g, '');
}

describe('WhatsApp identity resolution — Postgres real (find-2220a85e)', () => {
  let owner: DataSource;
  let app: DataSource;
  let enc: EncryptionService;

  beforeAll(async () => {
    owner = await new DataSource({ type: 'postgres', url: env('DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    app = await new DataSource({ type: 'postgres', url: env('APP_DATABASE_URL'), ssl: false, entities: ALL_ENTITIES }).initialize();
    enc = new EncryptionService({ get: () => env('ENCRYPTION_KEY') } as never);

    for (const [tid, oid, slug] of [[TENANT_A, ORG_A, 'e2e-wa-a'], [TENANT_B, ORG_B, 'e2e-wa-b']]) {
      await owner.query(
        `INSERT INTO tenants (id, org_id, name, slug) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [tid, oid, `E2E WhatsApp ${slug}`, slug],
      );
    }
    await owner.query(`DELETE FROM integrations WHERE tenant_id = ANY($1) AND provider = 'whatsapp'`, [[TENANT_A, TENANT_B]]);
    await owner.query(
      `INSERT INTO integrations (tenant_id, provider, status, credentials_encrypted) VALUES ($1, 'whatsapp', 'connected', $2)`,
      [TENANT_A, enc.encrypt(JSON.stringify({ phoneNumberId: PHONE_A, accessToken: 't', wabaId: 'w' }))],
    );
  }, 30000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await owner.query(`DELETE FROM integrations WHERE tenant_id = ANY($1)`, [[TENANT_A, TENANT_B]]);
      await owner.query(`DELETE FROM tenants WHERE id = ANY($1)`, [[TENANT_A, TENANT_B]]);
      await owner.destroy();
    }
    if (app?.isInitialized) await app.destroy();
  });

  it('causa raiz: conexão de aplicação sem contexto de tenant enxerga 0 linhas de integrations (RLS)', async () => {
    const rows = await app.query(`SELECT count(*)::int AS n FROM integrations WHERE provider = 'whatsapp' AND tenant_id = ANY($1)`, [[TENANT_A, TENANT_B]]);
    expect(rows[0].n).toBe(0);
  });

  it('fix: resolve via ADMIN_DATA_SOURCE o tenant vinculado ao phone_number_id', async () => {
    const provider = new WhatsAppCloudProvider(app, enc, { get: () => undefined } as never, owner);
    await expect(provider.resolveTenantByPhoneNumberId(PHONE_A)).resolves.toEqual({ kind: 'resolved', tenantId: TENANT_A });
    await expect(provider.resolveTenantByPhoneNumberId('5599999999999')).resolves.toEqual({ kind: 'unknown' });
  });

  it('fail-closed: mesmo phone_number_id em dois tenants vira conflict (nunca "primeira linha")', async () => {
    for (const tid of [TENANT_A, TENANT_B]) {
      await owner.query(`DELETE FROM integrations WHERE tenant_id = $1 AND provider = 'whatsapp'`, [tid]);
      await owner.query(
        `INSERT INTO integrations (tenant_id, provider, status, credentials_encrypted) VALUES ($1, 'whatsapp', 'connected', $2)`,
        [tid, enc.encrypt(JSON.stringify({ phoneNumberId: PHONE_SHARED, accessToken: 't', wabaId: 'w' }))],
      );
    }
    const provider = new WhatsAppCloudProvider(app, enc, { get: () => undefined } as never, owner);
    const result = await provider.resolveTenantByPhoneNumberId(PHONE_SHARED);
    expect(result.kind).toBe('conflict');
  });
});
