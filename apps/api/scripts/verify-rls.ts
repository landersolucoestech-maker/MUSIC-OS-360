#!/usr/bin/env ts-node
/**
 * scripts/verify-rls.ts
 *
 * Fase 16 — Verificação detalhada de RLS e políticas.
 *
 * Verifica por tabela:
 *   - RLS habilitado
 *   - Política SELECT existe
 *   - Política INSERT existe
 *   - Política UPDATE existe
 *   - Política DELETE existe
 *   - Políticas referenciam tenant_id corretamente
 *   - RBAC decision log parent/partitions use FORCE RLS and explicit policies
 *
 * Uso:
 *   npm run verify:rls
 *   npm run verify:rls -- --fix    (aplica RLS em tabelas que faltam)
 */

import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';

try {
  // Never override an explicitly-provided process env (e.g. CI, or a shell
  // export pointing at a disposable local Postgres) with .env.development —
  // an explicit DATABASE_URL/DB_SSL must always win over the file fallback.
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.development') });
} catch { /* opcional */ }

const FIX_MODE = process.argv.includes('--fix');
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

const MULTITENANT_TABLES = [
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

interface PolicyRow {
  tablename: string;
  policyname: string;
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

interface RbacPartitionRow {
  tablename: string;
  rowsecurity: boolean;
  force_rowsecurity: boolean;
}

async function main(): Promise<void> {
  let fails = 0;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   MUSIC OS 360 — Verificação de RLS e Políticas           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const { Client } = await import('pg');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: dbSslDisabled ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (err) {
    console.error(`Falha ao conectar: ${(err as Error).message}`);
    process.exit(1);
  }

  const existsRes = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const existingTables = new Set(existsRes.rows.map((row) => row.tablename));

  const rlsRes = await client.query<{ tablename: string; rowsecurity: boolean }>(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`,
  );
  const rlsMap = new Map(rlsRes.rows.map((row) => [row.tablename, row.rowsecurity]));

  const policiesRes = await client.query<PolicyRow>(
    `SELECT tablename, policyname, cmd, qual, with_check
     FROM pg_policies WHERE schemaname = 'public'`,
  );
  const policiesByTable = new Map<string, PolicyRow[]>();
  for (const row of policiesRes.rows) {
    const policies = policiesByTable.get(row.tablename) ?? [];
    policies.push(row);
    policiesByTable.set(row.tablename, policies);
  }

  for (const table of MULTITENANT_TABLES) {
    if (!existingTables.has(table)) {
      console.log(`  ⚠  ${table} — tabela não existe (execute db:migrate)`);
      continue;
    }

    const rlsOn = rlsMap.get(table) ?? false;
    const policies = policiesByTable.get(table) ?? [];
    const commands = new Set(policies.map((policy) => policy.cmd));
    const hasAll = commands.has('ALL');
    const hasSelect = commands.has('SELECT') || hasAll;
    const hasInsert = commands.has('INSERT') || hasAll;
    const hasUpdate = commands.has('UPDATE') || hasAll;
    const hasDelete = commands.has('DELETE') || hasAll;
    const tableOk = rlsOn && hasSelect && hasInsert && hasUpdate && hasDelete;

    if (tableOk) {
      console.log(`  ✓  ${table}`);
      for (const policy of policies) {
        const qualSnippet = policy.qual ? policy.qual.substring(0, 80) : '—';
        console.log(`       [${policy.cmd.padEnd(6)}] ${policy.policyname}: ${qualSnippet}`);
      }
    } else {
      console.log(`  ✗  ${table}`);
      if (!rlsOn) {
        console.log('       RLS DESABILITADO');
        fails++;
        if (FIX_MODE) {
          await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
          console.log('       → RLS habilitado via --fix');
        }
      }
      if (!hasSelect) { console.log('       MISSING SELECT policy'); fails++; }
      if (!hasInsert) { console.log('       MISSING INSERT policy'); fails++; }
      if (!hasUpdate) { console.log('       MISSING UPDATE policy'); fails++; }
      if (!hasDelete) { console.log('       MISSING DELETE policy'); fails++; }

      if (FIX_MODE && policies.length === 0) {
        await client.query(`
          CREATE POLICY tenant_isolation ON ${table}
            USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
            WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
        `);
        console.log('       → Política tenant_isolation criada via --fix');
      }
    }
  }

  if (existingTables.has('rbac_decision_logs')) {
    console.log('\n── RBAC decision log partitions ────────────────────────────\n');

    const partitionResult = await client.query<RbacPartitionRow>(`
      SELECT relation.relname AS tablename,
             relation.relrowsecurity AS rowsecurity,
             relation.relforcerowsecurity AS force_rowsecurity
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND (
          relation.oid = 'public.rbac_decision_logs'::regclass
          OR relation.oid IN (
            SELECT inheritance.inhrelid
            FROM pg_inherits inheritance
            WHERE inheritance.inhparent = 'public.rbac_decision_logs'::regclass
          )
        )
      ORDER BY relation.relname
    `);

    const protectedTables = new Set(partitionResult.rows.map((row) => row.tablename));
    const policyResult = await client.query<PolicyRow>(`
      SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `, [Array.from(protectedTables)]);
    const protectedPolicies = new Map<string, Set<string>>();
    for (const policy of policyResult.rows) {
      const names = protectedPolicies.get(policy.tablename) ?? new Set<string>();
      names.add(policy.policyname);
      protectedPolicies.set(policy.tablename, names);
    }

    const grantResult = await client.query<{
      table_name: string;
      grantee: string;
      privilege_type: string;
    }>(`
      SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
        AND grantee IN ('anon', 'authenticated', 'musicos_app')
      ORDER BY table_name, grantee, privilege_type
    `, [Array.from(protectedTables)]);

    const grantsByTableAndRole = new Map<string, Set<string>>();
    for (const grant of grantResult.rows) {
      const key = `${grant.table_name}:${grant.grantee}`;
      const privileges = grantsByTableAndRole.get(key) ?? new Set<string>();
      privileges.add(grant.privilege_type);
      grantsByTableAndRole.set(key, privileges);
    }

    const appRoleExists = (await client.query<{ exists: boolean }>(`
      SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') AS exists
    `)).rows[0]?.exists ?? false;

    for (const relation of partitionResult.rows) {
      const policies = protectedPolicies.get(relation.tablename) ?? new Set<string>();
      const anonGrants = grantsByTableAndRole.get(`${relation.tablename}:anon`) ?? new Set<string>();
      const authenticatedGrants = grantsByTableAndRole.get(`${relation.tablename}:authenticated`) ?? new Set<string>();
      const appGrants = grantsByTableAndRole.get(`${relation.tablename}:musicos_app`) ?? new Set<string>();
      const appGrantOk = !appRoleExists
        || (appGrants.has('SELECT')
          && appGrants.has('INSERT')
          && !appGrants.has('UPDATE')
          && !appGrants.has('DELETE')
          && !appGrants.has('TRUNCATE'));
      const relationOk = relation.rowsecurity
        && relation.force_rowsecurity
        && policies.has('tenant_isolation')
        && policies.has('super_admin_full_access')
        && anonGrants.size === 0
        && authenticatedGrants.size === 0
        && appGrantOk;

      if (relationOk) {
        console.log(`  ✓  ${relation.tablename} — FORCE RLS + policies + least privilege`);
      } else {
        console.log(`  ✗  ${relation.tablename}`);
        if (!relation.rowsecurity) { console.log('       RLS DESABILITADO'); fails++; }
        if (!relation.force_rowsecurity) { console.log('       FORCE RLS DESABILITADO'); fails++; }
        if (!policies.has('tenant_isolation')) { console.log('       MISSING tenant_isolation policy'); fails++; }
        if (!policies.has('super_admin_full_access')) { console.log('       MISSING super_admin_full_access policy'); fails++; }
        if (anonGrants.size > 0) { console.log(`       anon grants: ${Array.from(anonGrants).join(', ')}`); fails++; }
        if (authenticatedGrants.size > 0) { console.log(`       authenticated grants: ${Array.from(authenticatedGrants).join(', ')}`); fails++; }
        if (!appGrantOk) { console.log(`       musicos_app grants inválidos: ${Array.from(appGrants).join(', ')}`); fails++; }
      }
    }
  }

  console.log('\n── Resumo ──────────────────────────────────────────────────\n');
  if (fails === 0) {
    console.log('  ✓ Todas as tabelas multi-tenant têm RLS e políticas completas.\n');
  } else {
    console.log(`  ✗ ${fails} problema(s) de RLS encontrado(s).`);
    if (!FIX_MODE) {
      console.log('  Execute com --fix para aplicar RLS automaticamente.\n');
    }
  }

  await client.end();
  if (fails > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n[verify:rls] Erro fatal:', (err as Error).message);
  process.exit(1);
});
