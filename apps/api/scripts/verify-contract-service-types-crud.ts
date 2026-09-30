#!/usr/bin/env ts-node
/**
 * scripts/verify-contract-service-types-crud.ts  (Part 83 — one-off)
 *
 * Physical proof of real CRUD on contract_service_types in the DEV database, beyond the
 * schema/RLS already covered by verify:rls and verify:tenant-isolation.
 *
 * Flow: creates synthetic Tenant A and Tenant B → INSERT as A → active SELECT
 * as A (sees it) → duplicate slug conflict in the same tenant (must fail) →
 * INSERT as B → SELECT of A's record as B (RLS blocks, 0 rows) →
 * UPDATE as A → soft delete (active=false) as A → confirms absence from the
 * "active" listing → confirms physical presence (soft delete, not hard) →
 * full cleanup (real hard delete + synthetic tenants/orgs).
 *
 * Usage: npm run verify:contract-service-types
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
} catch { /* no valid URL */ }
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
    console.error('\n  ✗ ABORTED: DATABASE_URL points to the Supabase PRODUCTION ref.\n');
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
  ok('Connected to PostgreSQL');

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
    ok('Synthetic orgs and tenants created');

    // TEST 1: INSERT as Tenant A
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    await client.query(
      `INSERT INTO contract_service_types (id, tenant_id, name, slug, client_types, financial_model)
       VALUES ($1, $2, 'Distribuição Teste', 'distribuicao_teste', '["artista"]'::jsonb, 'valor_fixo')`,
      [cstA, tenantA],
    );
    await client.query('COMMIT');
    ok('TEST 1: INSERT como Tenant A'); passed++;

    // TEST 2: active SELECT as Tenant A → sees its own record
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const own = await client.query(
      `SELECT id, active FROM contract_service_types WHERE id = $1 AND active = true`, [cstA],
    );
    await client.query('ROLLBACK');
    if (own.rowCount === 1) { ok('TEST 2: SELECT of own tenant returns the active record'); passed++; }
    else { fail('TEST 2: SELECT of own tenant did not return the record'); failed++; }

    // TEST 3: duplicate slug in the same tenant → uniqueness violation
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
    if (dupRejected) { ok('TEST 3: duplicate slug in the same tenant rejected (uq_contract_service_types_tenant_slug)'); passed++; }
    else { fail('TEST 3: FAIL — duplicate slug was accepted, tenant-scoped uniqueness is not working'); failed++; }

    // TEST 4: INSERT as Tenant B (same slug, different tenant — must work)
    await client.query('BEGIN');
    await setTenant(client, tenantB);
    await client.query(
      `INSERT INTO contract_service_types (id, tenant_id, name, slug, client_types, financial_model)
       VALUES ($1, $2, 'Distribuição Teste B', 'distribuicao_teste', '["artista"]'::jsonb, 'valor_fixo')`,
      [cstB, tenantB],
    );
    await client.query('COMMIT');
    ok('TEST 4: INSERT as Tenant B with the same slug (uniqueness is per tenant, not global)'); passed++;

    // TEST 5: SELECT of A's record as Tenant B → RLS blocks (0 rows)
    await client.query('BEGIN');
    await setTenant(client, tenantB);
    const crossRead = await client.query(`SELECT id FROM contract_service_types WHERE id = $1`, [cstA]);
    await client.query('ROLLBACK');
    if ((crossRead.rowCount ?? 0) === 0) { ok('TEST 5: SELECT cross-tenant bloqueado por RLS — 0 linhas'); passed++; }
    else { fail(`TEST 5: CRITICAL FAILURE — RLS allowed cross-tenant read (${crossRead.rowCount} rows)`); failed++; }

    // TEST 6: UPDATE as Tenant A
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const upd = await client.query(
      `UPDATE contract_service_types SET name = 'Distribuição Teste (editado)' WHERE id = $1`, [cstA],
    );
    await client.query('COMMIT');
    if (upd.rowCount === 1) { ok('TEST 6: UPDATE as Tenant A affected 1 row'); passed++; }
    else { fail('TEST 6: UPDATE did not affect the expected row'); failed++; }

    // TEST 7: soft-delete (active=false) as Tenant A
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    await client.query(`UPDATE contract_service_types SET active = false, deleted_at = now() WHERE id = $1`, [cstA]);
    const afterSoftDelete = await client.query(
      `SELECT active, deleted_at FROM contract_service_types WHERE id = $1 AND deleted_at IS NULL`, [cstA],
    );
    await client.query('COMMIT');
    if ((afterSoftDelete.rowCount ?? 0) === 0) { ok('TEST 7: soft-delete confirmed — record no longer appears in "deleted_at IS NULL" queries'); passed++; }
    else { fail('TEST 7: FAIL — soft-delete did not remove the record from the active listing'); failed++; }

    // TEST 8: the record still exists physically (soft delete, not hard delete)
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const stillPhysical = await client.query(`SELECT id FROM contract_service_types WHERE id = $1`, [cstA]);
    await client.query('ROLLBACK');
    if (stillPhysical.rowCount === 1) { ok('TEST 8: record still exists physically after soft-delete (never a physical DELETE)'); passed++; }
    else { fail('TEST 8: FAIL — soft-delete removed the row physically'); failed++; }

  } finally {
    info('Cleaning up synthetic data…');
    try {
      await client.query(`DELETE FROM contract_service_types WHERE id IN ($1, $2)`, [cstA, cstB]);
      await client.query(`DELETE FROM tenants WHERE id IN ($1, $2)`, [tenantA, tenantB]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgA, orgB]);
      ok('Synthetic data removed — zero residue');
    } catch (cleanErr) {
      console.warn(`  ⚠  Partial cleanup: ${(cleanErr as Error).message}`);
    }
    await client.end();
  }

  console.log('\n── Result ──────────────────────────────────────────────────\n');
  console.log(`  Tests passed : ${passed}`);
  console.log(`  Tests failed : ${failed}`);

  if (failed === 0) {
    console.log('\n  ✓ contract_service_types CRUD + tenant isolation VALIDATED on real DEV.\n');
  } else {
    console.log('\n  ✗ CRITICAL FAILURES detected in contract_service_types.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[verify:contract-service-types] Fatal error:', (err as Error).message);
  process.exit(1);
});
