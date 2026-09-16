#!/usr/bin/env ts-node
/**
 * scripts/verify-supabase.ts
 *
 * Fase 16 — Verificação completa de provisionamento Supabase.
 *
 * Verifica:
 *   1. Variáveis de ambiente obrigatórias
 *   2. Conectividade com o banco PostgreSQL (Supabase)
 *   3. Migrations executadas (schema sincronizado)
 *   4. Existência física de todas as tabelas operacionais
 *   5. Presença de tenant_id em tabelas multi-tenant
 *   6. RLS enabled em todas as tabelas multi-tenant
 *   7. Políticas RLS existentes
 *
 * Uso:
 *   npm run verify:supabase
 *   npm run verify:supabase -- --fix    (aplica migrations pendentes)
 */

import 'reflect-metadata';
import * as path from 'path';

// ── Carregar .env ────────────────────────────────────────────────────────────
try {
  // The API package environment is authoritative. Root .env is fallback only.
  // Never override an explicitly-provided process env with either file —
  // an explicit DATABASE_URL must always win over the file fallback.
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.development') });
} catch { /* dotenv opcional */ }

const FIX_MODE = process.argv.includes('--fix');

// ── Cores para output ─────────────────────────────────────────────────────────
const OK   = '✓';
const FAIL = '✗';
const WARN = '⚠';
const INFO = '→';

function ok(msg: string)   { console.log(`  ${OK}  ${msg}`); }
function fail(msg: string) { console.log(`  ${FAIL}  ${msg}`); }
function warn(msg: string) { console.log(`  ${WARN}  ${msg}`); }
function info(msg: string) { console.log(`  ${INFO}  ${msg}`); }

// ── Variáveis requeridas ───────────────────────────────────────────────────────
const REQUIRED_VARS = [
  { key: 'DATABASE_URL',                description: 'PostgreSQL connection string (Supabase)' },
  { key: 'SUPABASE_URL',               description: 'Supabase project URL (https://xxx.supabase.co)' },
  { key: 'SUPABASE_ANON_KEY',          description: 'Supabase anon/public key (JWT audience)' },
  { key: 'ENCRYPTION_KEY',             description: 'AES-256 key (64 hex chars)' },
  { key: 'CORS_ORIGINS',               description: 'Allowed CORS origins (comma-separated)' },
];

const RECOMMENDED_VARS = [
  { key: 'SUPABASE_SERVICE_ROLE_KEY',  description: 'Supabase service role key (admin ops)' },
  { key: 'REDIS_URL',                  description: 'Redis connection (BullMQ queues)' },
  { key: 'SENTRY_DSN',                 description: 'Sentry error tracking' },
  { key: 'STRIPE_SECRET_KEY',          description: 'Stripe API key (billing)' },
  { key: 'STRIPE_WEBHOOK_SECRET',      description: 'Stripe webhook signing secret' },
];

// ── Tabelas operacionais esperadas ────────────────────────────────────────────
const EXPECTED_TABLES: string[] = [
  'organizations',
  'tenants',
  'org_members',
  'billing_subscriptions',
  'artists',
  'works',
  'phonograms',
  'contracts',
  'contract_templates',
  'transactions',
  'invoices',
  'clients',
  'leads',
  'lead_interactions',
  'contacts',
  'contact_attachments',
  'contact_contracts',
  'contact_timeline',
  'lead_uploads',
  'operational_tasks',
  'campaigns',
  'briefings',
  'events',
  'projects',
  'releases',
  'shares',
  'takedowns',
  'support_tickets',
  'notifications',
  'uploads',
  'integrations',
  'oauth_connections',
  'webhook_events',
  'audit_logs',
  'ai_jobs',
  'artist_goals',
  'content_detections',
  'ecad_reports',
  'employees',
  'payroll_entries',
  'leave_requests',
  'workflow_transitions',
  'domain_event_log',
  'activity_logs',
  'conversations',
  'conversation_messages',
  'conversation_notes',
  'forms',
  'form_submissions',
  // Phase 11
  'campaign_tasks',
  'campaign_assets',
  // Phase 13
  'ai_usage_logs',
];

// ── Tabelas multi-tenant (devem ter RLS + tenant_id) ─────────────────────────
const MULTITENANT_TABLES: string[] = [
  'artists', 'works', 'phonograms', 'contracts', 'contract_templates',
  'transactions', 'invoices', 'clients', 'leads', 'lead_interactions',
  'campaigns', 'briefings', 'events', 'projects', 'releases', 'shares',
  'takedowns', 'support_tickets', 'notifications', 'uploads',
  'audit_logs', 'ai_jobs', 'artist_goals', 'content_detections',
  'ecad_reports', 'employees', 'payroll_entries', 'leave_requests',
  'workflow_transitions', 'domain_event_log', 'activity_logs',
  'conversations', 'conversation_messages', 'conversation_notes',
  'forms', 'form_submissions',
  'contacts', 'contact_attachments', 'contact_contracts', 'contact_timeline',
  'lead_uploads', 'operational_tasks',
  'campaign_tasks', 'campaign_assets', 'ai_usage_logs',
];

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let totalFails = 0;
  let totalWarns = 0;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   MUSIC OS 360 — Verificação de Provisionamento Supabase  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ── 1. Variáveis obrigatórias ────────────────────────────────────────────
  console.log('── 1. Variáveis de Ambiente ──────────────────────────────────\n');

  let missingRequired = 0;
  for (const v of REQUIRED_VARS) {
    const val = process.env[v.key];
    if (!val) {
      fail(`${v.key} — AUSENTE — ${v.description}`);
      missingRequired++;
      totalFails++;
    } else {
      const masked = val.length > 12 ? val.substring(0, 8) + '…' + val.slice(-4) : '***';
      ok(`${v.key} = ${masked}`);
    }
  }
  for (const v of RECOMMENDED_VARS) {
    const val = process.env[v.key];
    if (!val) {
      warn(`${v.key} — não configurado (opcional) — ${v.description}`);
      totalWarns++;
    } else {
      const masked = val.length > 12 ? val.substring(0, 8) + '…' + val.slice(-4) : '***';
      ok(`${v.key} = ${masked}`);
    }
  }

  if (missingRequired > 0) {
    console.log(`\n  BLOQUEADO: ${missingRequired} variável(is) obrigatória(s) ausente(s).`);
    console.log('  Configure o .env ou secrets do provedor antes de continuar.\n');
    process.exit(1);
  }

  // Validação extra: ENCRYPTION_KEY deve ter 64 hex chars
  const encKey = process.env['ENCRYPTION_KEY'] ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    fail('ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (AES-256)');
    totalFails++;
  } else {
    ok('ENCRYPTION_KEY formato válido (64 hex chars)');
  }

  // ── 2. Conectividade com Supabase ─────────────────────────────────────────
  console.log('\n── 2. Conectividade com Supabase (PostgreSQL) ───────────────\n');

  const { Client } = await import('pg');
  const databaseUrl = process.env['DATABASE_URL'];
  let databaseHost = '';
  try {
    databaseHost = new URL(databaseUrl ?? '').hostname;
  } catch {
    fail('DATABASE_URL inválida');
    process.exit(1);
  }
  const sslDisabled = process.env['DB_SSL'] === 'false'
    || ['localhost', '127.0.0.1', '::1'].includes(databaseHost);
  const client = new Client({
    connectionString: databaseUrl,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    ok('Conexão PostgreSQL estabelecida');

    const res = await client.query('SELECT version()');
    ok(`PostgreSQL: ${(res.rows[0] as { version: string }).version.split(' ').slice(0, 2).join(' ')}`);
  } catch (err) {
    fail(`Falha ao conectar ao PostgreSQL: ${(err as Error).message}`);
    console.log('\n  BLOQUEADO: Sem conectividade com o banco de dados.\n');
    process.exit(1);
  }

  // ── 3. Migrations ─────────────────────────────────────────────────────────
  console.log('\n── 3. Estado das Migrations ─────────────────────────────────\n');

  try {
    const { AppDataSource } = await import('../src/database/datasource');
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();

    const hasPending = await AppDataSource.showMigrations();
    if (!hasPending) {
      ok('Nenhuma migration pendente — schema sincronizado');
    } else {
      warn('Existem migrations pendentes');
      if (FIX_MODE) {
        info('--fix: Aplicando migrations pendentes…');
        await AppDataSource.runMigrations({ transaction: 'each' });
        ok('Migrations aplicadas');
      } else {
        fail('Execute: npm run db:migrate');
        totalFails++;
      }
    }

    // Migrations aplicadas
    const applied = await client.query(
      `SELECT name, "timestamp" FROM musicos360_migrations ORDER BY "timestamp" ASC`
    );
    ok(`Migrations aplicadas: ${applied.rowCount ?? 0}`);
    for (const row of (applied.rows as Array<{ name: string; timestamp: string }>)) {
      info(`  ${row.name}`);
    }
  } catch (err) {
    warn(`Não foi possível verificar migrations via TypeORM: ${(err as Error).message}`);
    totalWarns++;
  }

  // ── 4. Tabelas físicas ────────────────────────────────────────────────────
  console.log('\n── 4. Tabelas Físicas no Supabase ───────────────────────────\n');

  const existingRes = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const existingTables = new Set(existingRes.rows.map(r => r.tablename));

  let missingTables = 0;
  for (const table of EXPECTED_TABLES) {
    if (existingTables.has(table)) {
      ok(table);
    } else {
      fail(`${table} — AUSENTE`);
      missingTables++;
      totalFails++;
    }
  }

  if (missingTables > 0) {
    warn(`${missingTables} tabela(s) ausente(s) — execute: npm run db:migrate`);
  }

  // ── 5. RLS ────────────────────────────────────────────────────────────────
  console.log('\n── 5. Row Level Security ────────────────────────────────────\n');

  const rlsRes = await client.query<{ tablename: string; rowsecurity: boolean }>(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const rlsMap = new Map(rlsRes.rows.map(r => [r.tablename, r.rowsecurity]));

  let rlsFails = 0;
  for (const table of MULTITENANT_TABLES) {
    if (!existingTables.has(table)) continue; // já reportado acima
    const hasRls = rlsMap.get(table);
    if (hasRls) {
      ok(`RLS habilitado: ${table}`);
    } else {
      fail(`RLS DESABILITADO: ${table}`);
      rlsFails++;
      totalFails++;
    }
  }

  if (rlsFails === 0) {
    ok('Todas as tabelas multi-tenant têm RLS habilitado');
  }

  // ── 6. Políticas RLS ───────────────────────────────────────────────────────
  console.log('\n── 6. Políticas RLS ─────────────────────────────────────────\n');

  const policiesRes = await client.query<{ tablename: string; policyname: string }>(
    `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`
  );
  const policiesByTable = new Map<string, string[]>();
  for (const row of policiesRes.rows) {
    const arr = policiesByTable.get(row.tablename) ?? [];
    arr.push(row.policyname);
    policiesByTable.set(row.tablename, arr);
  }

  let policyFails = 0;
  for (const table of MULTITENANT_TABLES) {
    if (!existingTables.has(table)) continue;
    const policies = policiesByTable.get(table) ?? [];
    if (policies.length > 0) {
      ok(`${table}: ${policies.join(', ')}`);
    } else {
      fail(`${table}: SEM POLÍTICAS RLS`);
      policyFails++;
      totalFails++;
    }
  }

  if (policyFails === 0) {
    ok('Todas as tabelas multi-tenant têm políticas RLS');
  }

  // ── 7. tenant_id em tabelas multi-tenant ─────────────────────────────────
  console.log('\n── 7. Coluna tenant_id nas Tabelas Multi-Tenant ────────────\n');

  const colRes = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'tenant_id'`
  );
  const tablesWithTenantId = new Set(colRes.rows.map(r => r.table_name));

  for (const table of MULTITENANT_TABLES) {
    if (!existingTables.has(table)) continue;
    if (tablesWithTenantId.has(table)) {
      ok(`${table}.tenant_id ✓`);
    } else {
      fail(`${table} — SEM COLUNA tenant_id`);
      totalFails++;
    }
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   RESUMO DE VERIFICAÇÃO                                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (totalFails === 0 && totalWarns === 0) {
    console.log('  ✓ PLATAFORMA TOTALMENTE PROVISIONADA E OPERACIONAL\n');
  } else if (totalFails === 0) {
    console.log(`  ✓ Verificação concluída com ${totalWarns} aviso(s) — não bloqueantes\n`);
  } else {
    console.log(`  ✗ ${totalFails} falha(s) encontrada(s) — provisionamento INCOMPLETO\n`);
    console.log('  Resolva as falhas acima antes de colocar em produção.\n');
  }

  await client.end();

  if (totalFails > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n[verify:supabase] Erro fatal:', (err as Error).message);
  process.exit(1);
});
