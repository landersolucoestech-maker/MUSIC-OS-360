import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.development'));

interface SummaryRow {
  requests_observed: string;
  tenants_observed: string;
  roles_observed: string;
  endpoints_observed: string;
  resources_observed: string;
  allow_match: string;
  deny_match: string;
  would_allow: string;
  would_deny: string;
  cache_hits: string;
  cache_misses: string;
  resolver_failures: string;
}

function count(value: string): number {
  return Number.parseInt(value, 10) || 0;
}

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({
    connectionString,
    ssl:
      process.env['DB_SSL'] === 'false'
        ? false
        : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const table = await client.query<{ exists: boolean }>(
      `SELECT to_regclass('public.rbac_decision_logs') IS NOT NULL AS exists`,
    );
    if (!table.rows[0]?.exists) {
      throw new Error(
        'rbac_decision_logs does not exist; run database migrations first',
      );
    }

    const summary = await client.query<SummaryRow>(`
      SELECT
        COUNT(DISTINCT request_id)::text AS requests_observed,
        COUNT(DISTINCT tenant_id)::text AS tenants_observed,
        COUNT(DISTINCT role_slug)::text AS roles_observed,
        COUNT(DISTINCT endpoint)::text AS endpoints_observed,
        COUNT(DISTINCT resource)::text AS resources_observed,
        COUNT(*) FILTER (
          WHERE comparison_result = 'ALLOW_MATCH'
        )::text AS allow_match,
        COUNT(*) FILTER (
          WHERE comparison_result = 'DENY_MATCH'
        )::text AS deny_match,
        COUNT(*) FILTER (
          WHERE comparison_result = 'WOULD_ALLOW'
        )::text AS would_allow,
        COUNT(*) FILTER (
          WHERE comparison_result = 'WOULD_DENY'
        )::text AS would_deny,
        COUNT(*) FILTER (WHERE cache_hit)::text AS cache_hits,
        COUNT(*) FILTER (WHERE NOT cache_hit)::text AS cache_misses,
        COUNT(*) FILTER (
          WHERE resolver_reason IN (
            'resolver_error', 'database_unavailable', 'no_role_id'
          )
        )::text AS resolver_failures
      FROM rbac_decision_logs
      WHERE authority_mode = 'SHADOW'
    `);
    const row = summary.rows[0];

    const leakage = await client.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM rbac_decision_logs log
      JOIN roles role ON role.id = log.role_id
      WHERE log.tenant_id IS NOT NULL
        AND role.tenant_id IS NOT NULL
        AND role.tenant_id <> log.tenant_id
    `);
    const crossTenant = count(leakage.rows[0]?.count ?? '0');
    const requests = count(row.requests_observed);
    const tenants = count(row.tenants_observed);
    const roles = count(row.roles_observed);
    const endpoints = count(row.endpoints_observed);
    const resources = count(row.resources_observed);
    const wouldAllow = count(row.would_allow);
    const wouldDeny = count(row.would_deny);
    const resolverFailures = count(row.resolver_failures);
    const sampleReady =
      requests >= 1_000 &&
      endpoints >= 10 &&
      resources >= 5 &&
      roles >= 5 &&
      tenants >= 3;
    const approved =
      sampleReady &&
      wouldAllow === 0 &&
      wouldDeny === 0 &&
      resolverFailures === 0 &&
      crossTenant === 0;

    console.log(`STEP 12-J.3A

STATUS:
${sampleReady ? 'OK' : 'PARTIAL'}

OBSERVED_REQUESTS:
${requests}

OBSERVED_TENANTS:
${tenants}

OBSERVED_ROLES:
${roles}

OBSERVED_ENDPOINTS:
${endpoints}

ALLOW_MATCH:
${count(row.allow_match)}

DENY_MATCH:
${count(row.deny_match)}

WOULD_ALLOW:
${wouldAllow}

WOULD_DENY:
${wouldDeny}

CACHE:
${requests > 0 && resolverFailures === 0 ? 'OK' : 'RISK'}

MULTI_TENANCY:
${crossTenant === 0 ? 'OK' : 'FAIL'}

OBSERVABILITY:
${sampleReady ? 'OK' : 'PARTIAL'}

READINESS:
${approved ? 'APPROVED' : 'REJECTED'}

RBAC_PERSISTED_AUTHORITY:
SHADOW

PROMOTION TO ON:
${approved ? 'YES' : 'NO'}`);

    const divergences = await client.query(`
      SELECT resource, action, endpoint, tenant_id, role_slug, permission,
             comparison_result, resolver_reason, COUNT(*)::integer AS requests
      FROM rbac_decision_logs
      WHERE comparison_result IN ('WOULD_ALLOW', 'WOULD_DENY')
      GROUP BY resource, action, endpoint, tenant_id, role_slug, permission,
               comparison_result, resolver_reason
      ORDER BY requests DESC, resource, action
      LIMIT 100
    `);
    if (divergences.rows.length > 0) {
      console.log('\nDIVERGENCIAS:');
      console.table(divergences.rows);
    }
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
