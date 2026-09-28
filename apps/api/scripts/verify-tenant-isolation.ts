#!/usr/bin/env ts-node
/**
 * scripts/verify-tenant-isolation.ts
 *
 * Phase 18 — Automated proof of tenant isolation on the real database.
 *
 * Flow:
 *   1. Creates Tenant A (temporary UUID)
 *   2. Creates Tenant B (temporary UUID)
 *   3. Inserts an artist in Tenant A with app.current_tenant_id = Tenant A
 *   4. Inserts an artist in Tenant B with app.current_tenant_id = Tenant B
 *   5. Tries to read A's artists with app.current_tenant_id = Tenant B
 *      → must return 0 rows (RLS blocks)
 *   6. Tries to read B's artists with app.current_tenant_id = Tenant A
 *      → must return 0 rows (RLS blocks)
 *   7. Tries a cross-tenant UPDATE
 *      → must update 0 rows (RLS blocks)
 *   8. Cleanup of temporary data
 *
 * Usage:
 *   npm run verify:tenant-isolation
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
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.development') });    // apps/api/.env.development when run from package
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });    // apps/api/.env.development (URL-encoded passwords)
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') }); // apps/.env.development (fallback)
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.development') }); // root .env.development (fallback)
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
  // Switch to authenticated role so RLS policies apply (postgres superuser bypasses RLS)
  await client.query(`SET LOCAL ROLE TO authenticated`);
  await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
}

async function main(): Promise<void> {
  // Guard: this script INSERTs/DELETEs real rows in organizations/tenants/artists.
  // Never allow it to run against the production Supabase ref, regardless of which
  // secret/CI variable happened to populate DATABASE_URL.
  const targetRef = extractSupabaseRef(databaseUrl);
  if (targetRef === SUPABASE_PROD_REF) {
    console.error('\n  ✗ ABORTED: DATABASE_URL points to the Supabase PRODUCTION ref.');
    console.error('    This script writes/deletes real rows in organizations/tenants/artists.');
    console.error('    Point DATABASE_URL to a non-production branch/staging before running.\n');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   MUSIC OS 360 — Fase 18: Tenant Isolation Test           ║');
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
  const orgA    = randomUUID();
  const orgB    = randomUUID();

  const artistA = randomUUID();
  const artistB = randomUUID();

  info(`Tenant A: ${tenantA}`);
  info(`Tenant B: ${tenantB}`);

  try {
    // ── Setup: create orgs and tenants ────────────────────────────────────────
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO organizations (id, name, slug, plan) VALUES ($1, 'Test Org A', $2, 'starter')`,
      [orgA, `test-org-a-${tenantA.slice(0,8)}`],
    );
    await client.query(
      `INSERT INTO organizations (id, name, slug, plan) VALUES ($1, 'Test Org B', $2, 'starter')`,
      [orgB, `test-org-b-${tenantB.slice(0,8)}`],
    );
    await client.query(
      `INSERT INTO tenants (id, org_id, name, slug, plan) VALUES ($1, $2, 'Tenant A', $3, 'starter')`,
      [tenantA, orgA, `tenant-a-${tenantA.slice(0,8)}`],
    );
    await client.query(
      `INSERT INTO tenants (id, org_id, name, slug, plan) VALUES ($1, $2, 'Tenant B', $3, 'starter')`,
      [tenantB, orgB, `tenant-b-${tenantB.slice(0,8)}`],
    );

    await client.query('COMMIT');
    ok('Orgs e tenants criados');

    // ── Test 1: INSERT as Tenant A ────────────────────────────────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    await client.query(
      `INSERT INTO artists (id, tenant_id, stage_name, status)
       VALUES ($1, $2, 'Artista Test A', 'in_negotiation')`,
      [artistA, tenantA],
    );
    await client.query('COMMIT');
    ok('TEST 1: INSERT Artista A como Tenant A');
    passed++;

    // ── Test 2: INSERT as Tenant B ────────────────────────────────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantB);
    await client.query(
      `INSERT INTO artists (id, tenant_id, stage_name, status)
       VALUES ($1, $2, 'Artista Test B', 'in_negotiation')`,
      [artistB, tenantB],
    );
    await client.query('COMMIT');
    ok('TEST 2: INSERT Artista B como Tenant B');
    passed++;

    // ── Test 3: SELECT of A as Tenant A → must see 1 ────────────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const resA = await client.query(
      `SELECT id FROM artists WHERE id = $1`, [artistA],
    );
    await client.query('ROLLBACK');

    if (resA.rowCount === 1) {
      ok('TEST 3: SELECT of own tenant returns data');
      passed++;
    } else {
      fail('TEST 3: SELECT of own tenant returned 0 rows (RLS problem)');
      failed++;
    }

    // ── Test 4: SELECT of B as Tenant A → must see 0 (RLS blocks) ───────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const crossRead = await client.query(
      `SELECT id FROM artists WHERE id = $1`, [artistB],
    );
    await client.query('ROLLBACK');

    if ((crossRead.rowCount ?? 0) === 0) {
      ok('TEST 4: SELECT cross-tenant bloqueado por RLS — retornou 0 linhas');
      passed++;
    } else {
      fail(`TEST 4: CRITICAL FAILURE — RLS allowed cross-tenant read (${crossRead.rowCount} rows)`);
      failed++;
    }

    // ── Test 5: UPDATE of B as Tenant A → must update 0 ─────────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const crossUpdate = await client.query(
      `UPDATE artists SET stage_name = 'HACK' WHERE id = $1`, [artistB],
    );
    await client.query('ROLLBACK');

    if ((crossUpdate.rowCount ?? 0) === 0) {
      ok('TEST 5: UPDATE cross-tenant bloqueado por RLS — afetou 0 linhas');
      passed++;
    } else {
      fail(`TEST 5: CRITICAL FAILURE — RLS allowed cross-tenant UPDATE (${crossUpdate.rowCount} row(s))`);
      failed++;
    }

    // ── Test 6: DELETE of B as Tenant A → must delete 0 ─────────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const crossDelete = await client.query(
      `DELETE FROM artists WHERE id = $1`, [artistB],
    );
    await client.query('ROLLBACK');

    if ((crossDelete.rowCount ?? 0) === 0) {
      ok('TEST 6: cross-tenant DELETE blocked by RLS — affected 0 rows');
      passed++;
    } else {
      fail(`TEST 6: CRITICAL FAILURE — RLS allowed cross-tenant DELETE (${crossDelete.rowCount} row(s))`);
      failed++;
    }

    // ── Test 7: No SET tenant → must block everything ────────────────────────
    try {
      await client.query('BEGIN');
      // Simulates an authenticated user without app.current_tenant_id. The
      // DATABASE_URL connection may be privileged; without SET ROLE, PostgreSQL may
      // bypass RLS by design and invalidate the test.
      await client.query(`SET LOCAL ROLE TO authenticated`);
      const noCtx = await client.query(
        `SELECT id FROM artists WHERE tenant_id = $1 LIMIT 1`, [tenantA],
      );
      await client.query('ROLLBACK');
      if ((noCtx.rowCount ?? 0) === 0) {
        ok('TEST 7: No tenant context → SELECT returns 0 rows (RLS blocks everything)');
        passed++;
      } else {
        fail('TEST 7: CRITICAL FAILURE — no tenant context returned data');
        failed++;
      }
    } catch {
      await client.query('ROLLBACK');
      ok('TEST 7: No tenant context → RLS threw an error (expected behavior)');
      passed++;
    }

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────────
    info('Cleaning up test data…');
    try {
      // Delete without RLS (privileged context) via a separate transaction
      await client.query(`DELETE FROM artists WHERE id IN ($1, $2)`,   [artistA, artistB]);
      await client.query(`DELETE FROM tenants WHERE id IN ($1, $2)`,   [tenantA, tenantB]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgA, orgB]);
      ok('Test data removed');
    } catch (cleanErr) {
      console.warn(`  ⚠  Cleanup parcial: ${(cleanErr as Error).message}`);
    }

    await client.end();
  }

  // ── Result ────────────────────────────────────────────────────────────────
  console.log('\n── Result ──────────────────────────────────────────────────\n');
  console.log(`  Tests passed : ${passed}`);
  console.log(`  Tests failed : ${failed}`);

  if (failed === 0) {
    console.log('\n  ✓ TENANT ISOLATION VALIDATED — RLS works correctly.\n');
  } else {
    console.log('\n  ✗ TENANT ISOLATION COMPROMISED — critical failures detected.\n');
    console.log('  Check the RLS policies and the tenant hook in the backend.\n');
    process.exit(1);
  }
}

function warn(msg: string) { console.log(`  ⚠  ${msg}`); }

main().catch((err) => {
  console.error('\n[verify:tenant-isolation] Fatal error:', (err as Error).message);
  process.exit(1);
});
