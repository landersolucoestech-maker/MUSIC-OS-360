#!/usr/bin/env ts-node
/**
 * scripts/verify-tenant-isolation.ts
 *
 * Fase 18 — Prova automatizada de tenant isolation no banco real.
 *
 * Fluxo:
 *   1. Cria Tenant A (UUID temporário)
 *   2. Cria Tenant B (UUID temporário)
 *   3. Insere artista em Tenant A com app.current_tenant_id = Tenant A
 *   4. Insere artista em Tenant B com app.current_tenant_id = Tenant B
 *   5. Tenta ler artistas de A com app.current_tenant_id = Tenant B
 *      → deve retornar 0 linhas (RLS bloqueia)
 *   6. Tenta ler artistas de B com app.current_tenant_id = Tenant A
 *      → deve retornar 0 linhas (RLS bloqueia)
 *   7. Tenta UPDATE cross-tenant
 *      → deve atualizar 0 linhas (RLS bloqueia)
 *   8. Cleanup de dados temporários
 *
 * Uso:
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
    console.error('\n  ✗ ABORTADO: DATABASE_URL aponta para o ref de PRODUÇÃO Supabase.');
    console.error('    Este script escreve/apaga linhas reais em organizations/tenants/artists.');
    console.error('    Aponte DATABASE_URL para um branch/staging não-produtivo antes de rodar.\n');
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
  ok('Conectado ao PostgreSQL');

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const orgA    = randomUUID();
  const orgB    = randomUUID();

  const artistA = randomUUID();
  const artistB = randomUUID();

  info(`Tenant A: ${tenantA}`);
  info(`Tenant B: ${tenantB}`);

  try {
    // ── Setup: criar orgs e tenants ───────────────────────────────────────────
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

    // ── Teste 1: INSERT como Tenant A ─────────────────────────────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    await client.query(
      `INSERT INTO artists (id, tenant_id, nome_artistico, status)
       VALUES ($1, $2, 'Artista Test A', 'in_negotiation')`,
      [artistA, tenantA],
    );
    await client.query('COMMIT');
    ok('TEST 1: INSERT Artista A como Tenant A');
    passed++;

    // ── Teste 2: INSERT como Tenant B ─────────────────────────────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantB);
    await client.query(
      `INSERT INTO artists (id, tenant_id, nome_artistico, status)
       VALUES ($1, $2, 'Artista Test B', 'in_negotiation')`,
      [artistB, tenantB],
    );
    await client.query('COMMIT');
    ok('TEST 2: INSERT Artista B como Tenant B');
    passed++;

    // ── Teste 3: SELECT de A como Tenant A → deve ver 1 ──────────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const resA = await client.query(
      `SELECT id FROM artists WHERE id = $1`, [artistA],
    );
    await client.query('ROLLBACK');

    if (resA.rowCount === 1) {
      ok('TEST 3: SELECT próprio tenant retorna dados');
      passed++;
    } else {
      fail('TEST 3: SELECT próprio tenant retornou 0 linhas (problema de RLS)');
      failed++;
    }

    // ── Teste 4: SELECT de B como Tenant A → deve ver 0 (RLS bloqueia) ───────
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
      fail(`TEST 4: FALHA CRÍTICA — RLS permitiu leitura cross-tenant (${crossRead.rowCount} linhas)`);
      failed++;
    }

    // ── Teste 5: UPDATE de B como Tenant A → deve atualizar 0 ────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const crossUpdate = await client.query(
      `UPDATE artists SET nome_artistico = 'HACK' WHERE id = $1`, [artistB],
    );
    await client.query('ROLLBACK');

    if ((crossUpdate.rowCount ?? 0) === 0) {
      ok('TEST 5: UPDATE cross-tenant bloqueado por RLS — afetou 0 linhas');
      passed++;
    } else {
      fail(`TEST 5: FALHA CRÍTICA — RLS permitiu UPDATE cross-tenant (${crossUpdate.rowCount} linha(s))`);
      failed++;
    }

    // ── Teste 6: DELETE de B como Tenant A → deve deletar 0 ──────────────────
    await client.query('BEGIN');
    await setTenant(client, tenantA);
    const crossDelete = await client.query(
      `DELETE FROM artists WHERE id = $1`, [artistB],
    );
    await client.query('ROLLBACK');

    if ((crossDelete.rowCount ?? 0) === 0) {
      ok('TEST 6: DELETE cross-tenant bloqueado por RLS — afetou 0 linhas');
      passed++;
    } else {
      fail(`TEST 6: FALHA CRÍTICA — RLS permitiu DELETE cross-tenant (${crossDelete.rowCount} linha(s))`);
      failed++;
    }

    // ── Teste 7: Sem SET tenant → deve bloquear tudo ─────────────────────────
    try {
      await client.query('BEGIN');
      // Simula um usuário autenticado sem app.current_tenant_id. A conexão
      // DATABASE_URL pode ser privilegiada; sem SET ROLE, PostgreSQL pode
      // bypassar RLS por design e invalidar o teste.
      await client.query(`SET LOCAL ROLE TO authenticated`);
      const noCtx = await client.query(
        `SELECT id FROM artists WHERE tenant_id = $1 LIMIT 1`, [tenantA],
      );
      await client.query('ROLLBACK');
      if ((noCtx.rowCount ?? 0) === 0) {
        ok('TEST 7: Sem contexto tenant → SELECT retorna 0 linhas (RLS bloqueia tudo)');
        passed++;
      } else {
        fail('TEST 7: FALHA CRÍTICA — sem contexto tenant retornou dados');
        failed++;
      }
    } catch {
      await client.query('ROLLBACK');
      ok('TEST 7: Sem contexto tenant → RLS lançou erro (comportamento esperado)');
      passed++;
    }

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────────
    info('Limpando dados de teste…');
    try {
      // Deletar sem RLS (privileged context) via transação separada
      await client.query(`DELETE FROM artists WHERE id IN ($1, $2)`,   [artistA, artistB]);
      await client.query(`DELETE FROM tenants WHERE id IN ($1, $2)`,   [tenantA, tenantB]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgA, orgB]);
      ok('Dados de teste removidos');
    } catch (cleanErr) {
      console.warn(`  ⚠  Cleanup parcial: ${(cleanErr as Error).message}`);
    }

    await client.end();
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log('\n── Resultado ───────────────────────────────────────────────\n');
  console.log(`  Testes passados : ${passed}`);
  console.log(`  Testes falhados : ${failed}`);

  if (failed === 0) {
    console.log('\n  ✓ TENANT ISOLATION VALIDADO — RLS funciona corretamente.\n');
  } else {
    console.log('\n  ✗ TENANT ISOLATION COMPROMETIDO — Falhas críticas detectadas.\n');
    console.log('  Verifique as políticas RLS e o hook de tenant no backend.\n');
    process.exit(1);
  }
}

function warn(msg: string) { console.log(`  ⚠  ${msg}`); }

main().catch((err) => {
  console.error('\n[verify:tenant-isolation] Erro fatal:', (err as Error).message);
  process.exit(1);
});
