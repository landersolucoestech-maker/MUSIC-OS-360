#!/usr/bin/env ts-node
/**
 * scripts/verify-contract-service-types-crud.ts  (Parte 83 — oneoff)
 *
 * Prova física de CRUD real em contract_service_types no banco DEV, além do
 * schema/RLS já cobertos por verify:rls e verify:tenant-isolation.
 *
 * Fluxo: cria Tenant A e Tenant B sintéticos → INSERT como A → SELECT ativo
 * como A (vê) → conflito de slug duplicado no mesmo tenant (deve falhar) →
 * INSERT como B → SELECT do registro de A como B (RLS bloqueia, 0 linhas) →
 * UPDATE como A → soft-delete (active=false) como A → confirma ausência na
 * listagem "ativos" → confirma presença física (soft delete, não hard) →
 * cleanup total (hard delete real + tenants/orgs sintéticos).
 *
 * Uso: npm run verify:contract-service-types
 */

import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { extractSupabaseRef, SUPABASE_PROD_REF } from '../src/core/config/env.schema';

try {
  // Never override an explicitly-provided process env (e.g. CI, or a shell
  // export pointing at a disposable local Postgres) with .env.development —
  // an explicit DATABASE_URL/DB_SSL must always win over the file fallback.
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.development') });
} catch { /* opcional */ }

const apiEnvText = fs.existsSync(path.resolve(process.cwd(), '.env.development'))
  ? fs.readFileSync(path.resolve(process.cwd(), '.env.development'), 'utf8')
  : '';
const apiEnvDatabaseUrl = apiEnvText.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const apiEnvDbSsl = apiEnvText.match(/^DB_SSL=(.+)$/m)?.[1]?.trim();
const databaseUrl = process.env['DATABASE_URL'] || apiEnvDatabaseUrl;
let databaseHost = '';
try {
  databaseHost = new URL(databaseUrl ?? '').hostname;
} catch { /* sem URL válida */ }
const dbSslDisabled = (process.env['DB_SSL'] ?? apiEnvDbSsl) === 'false'
  || ['localhost', '127.0.0.1', '::1'].includes(databaseHost);
if (dbSslDisabled) {
  process.env['PGSSLMODE'] = 'disable';
}

function ok(msg: string)   { console.log(`  ✓  ${msg}`); }
function fail(msg: string) { console.log(`  ✗  ${msg}`); }
function info(msg: string) { console.log(`  →  ${msg}`); }

async function setTenant(client: import('pg').Client, tenantId: string) {
  await client.query(`SET LOCAL ROLE TO authenticated`);
  await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
}

async function main(): Promise<void> {
  const targetRef = extractSupabaseRef(databaseUrl);
  if (targetRef === SUPABASE_PROD_REF) {
    console.error('\n  ✗ ABORTADO: DATABASE_URL aponta para o ref de PRODUÇÃO Supabase.\n');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   MUSIC OS 360 — contract_service_types CRUD real (P83)   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const { Client } = await import('pg');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: dbSslDisabled ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  ok('Conectado ao PostgreSQL');

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const orgA = randomUUID();
  const orgB = randomUUID();
  const cstA = randomUUID();
  const cstB = randomUUID();

  info(`Tenant A: ${tenantA}`);
  info(`Tenant B: ${tenantB}`);

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO organizations (id, name, slug, plan) VALUES ($1, 'CST Test Org A', $2, 'starter')`,
      [orgA, `cst-test-org-a-${tenantA.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO organizations (id, name, slug, plan) VALUES ($1, 'CST Test Org B', $2, 'starter')`,
      [orgB, `cst-test-org-b-${tenantB.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO tenants (id, org_id, name, slug, plan) VALUES ($1, $2, 'CST Tenant A', $3, 'starter')`,
      [tenantA, orgA, `cst-tenant-a-${tenantA.slice(0, 8)}`],
    );
    await client.query(
      `INSERT INTO tenants (id, org_id, name, slug, plan) VALUES ($1, $2, 'CST Tenant B', $3, 'starter')`,
      [tenantB, orgB, `cst-tenant-b-${tenantB.slice(0, 8)}`],
    );
    await client.query('COMMIT');
    ok('Orgs e tenants sintéticos criados');

    // TEST 1: INSERT como Tenant A
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    await client.query(
      `INSERT INTO contract_service_types (id, tenant_id, name, slug, client_types, financial_model)
       VALUES ($1, $2, 'Distribuição Teste', 'distribuicao_teste', '["artista"]'::jsonb, 'valor_fixo')`,
      [cstA, tenantA],
    );
    await client.query('COMMIT');
    ok('TEST 1: INSERT como Tenant A'); passed++;

    // TEST 2: SELECT ativo como Tenant A → vê o próprio registro
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const own = await client.query(
      `SELECT id, active FROM contract_service_types WHERE id = $1 AND active = true`, [cstA],
    );
    await client.query('ROLLBACK');
    if (own.rowCount === 1) { ok('TEST 2: SELECT do próprio tenant retorna o registro ativo'); passed++; }
    else { fail('TEST 2: SELECT do próprio tenant não retornou o registro'); failed++; }

    // TEST 3: slug duplicado no mesmo tenant → violação de unicidade
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    let dupRejected = false;
    try {
      await client.query(
        `INSERT INTO contract_service_types (id, tenant_id, name, slug, client_types, financial_model)
         VALUES ($1, $2, 'Duplicado', 'distribuicao_teste', '["artista"]'::jsonb, 'valor_fixo')`,
        [randomUUID(), tenantA],
      );
    } catch {
      dupRejected = true;
    }
    await client.query('ROLLBACK');
    if (dupRejected) { ok('TEST 3: slug duplicado no mesmo tenant rejeitado (uq_contract_service_types_tenant_slug)'); passed++; }
    else { fail('TEST 3: FALHA — slug duplicado foi aceito, unicidade tenant-scoped não está funcionando'); failed++; }

    // TEST 4: INSERT como Tenant B (mesmo slug, tenant diferente — deve funcionar)
    await client.query('BEGIN');
    await setTenant(client, tenantB);
    await client.query(
      `INSERT INTO contract_service_types (id, tenant_id, name, slug, client_types, financial_model)
       VALUES ($1, $2, 'Distribuição Teste B', 'distribuicao_teste', '["artista"]'::jsonb, 'valor_fixo')`,
      [cstB, tenantB],
    );
    await client.query('COMMIT');
    ok('TEST 4: INSERT como Tenant B com mesmo slug (unicidade é por tenant, não global)'); passed++;

    // TEST 5: SELECT do registro de A como Tenant B → RLS bloqueia (0 linhas)
    await client.query('BEGIN');
    await setTenant(client, tenantB);
    const crossRead = await client.query(`SELECT id FROM contract_service_types WHERE id = $1`, [cstA]);
    await client.query('ROLLBACK');
    if ((crossRead.rowCount ?? 0) === 0) { ok('TEST 5: SELECT cross-tenant bloqueado por RLS — 0 linhas'); passed++; }
    else { fail(`TEST 5: FALHA CRÍTICA — RLS permitiu leitura cross-tenant (${crossRead.rowCount} linhas)`); failed++; }

    // TEST 6: UPDATE como Tenant A
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const upd = await client.query(
      `UPDATE contract_service_types SET name = 'Distribuição Teste (editado)' WHERE id = $1`, [cstA],
    );
    await client.query('COMMIT');
    if (upd.rowCount === 1) { ok('TEST 6: UPDATE como Tenant A afetou 1 linha'); passed++; }
    else { fail('TEST 6: UPDATE não afetou a linha esperada'); failed++; }

    // TEST 7: soft-delete (active=false) como Tenant A
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    await client.query(`UPDATE contract_service_types SET active = false, deleted_at = now() WHERE id = $1`, [cstA]);
    const afterSoftDelete = await client.query(
      `SELECT active, deleted_at FROM contract_service_types WHERE id = $1 AND deleted_at IS NULL`, [cstA],
    );
    await client.query('COMMIT');
    if ((afterSoftDelete.rowCount ?? 0) === 0) { ok('TEST 7: soft-delete confirmado — registro não aparece mais em queries "deleted_at IS NULL"'); passed++; }
    else { fail('TEST 7: FALHA — soft-delete não excluiu o registro da listagem ativa'); failed++; }

    // TEST 8: registro ainda existe fisicamente (soft delete, não hard delete)
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const stillPhysical = await client.query(`SELECT id FROM contract_service_types WHERE id = $1`, [cstA]);
    await client.query('ROLLBACK');
    if (stillPhysical.rowCount === 1) { ok('TEST 8: registro ainda existe fisicamente após soft-delete (nunca DELETE físico)'); passed++; }
    else { fail('TEST 8: FALHA — soft-delete removeu a linha fisicamente'); failed++; }

  } finally {
    info('Limpando dados sintéticos…');
    try {
      await client.query(`DELETE FROM contract_service_types WHERE id IN ($1, $2)`, [cstA, cstB]);
      await client.query(`DELETE FROM tenants WHERE id IN ($1, $2)`, [tenantA, tenantB]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgA, orgB]);
      ok('Dados sintéticos removidos — zero resíduo');
    } catch (cleanErr) {
      console.warn(`  ⚠  Cleanup parcial: ${(cleanErr as Error).message}`);
    }
    await client.end();
  }

  console.log('\n── Resultado ───────────────────────────────────────────────\n');
  console.log(`  Testes passados : ${passed}`);
  console.log(`  Testes falhados : ${failed}`);

  if (failed === 0) {
    console.log('\n  ✓ contract_service_types CRUD + tenant isolation VALIDADOS na DEV real.\n');
  } else {
    console.log('\n  ✗ FALHAS CRÍTICAS detectadas em contract_service_types.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[verify:contract-service-types] Erro fatal:', (err as Error).message);
  process.exit(1);
});
