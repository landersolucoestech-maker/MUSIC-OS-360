/**
 * STEP 12-J.5 — automatic GO/NO-GO of the RBAC cutover.
 *
 * Reads (read-only) rbac_decision_logs, applies the official query and emits the verdict.
 * Does NOT change data. Exit 0 = APPROVED, exit 3 = REJECTED.
 *
 * Usage: DATABASE_URL=... DB_SSL=false npx tsx scripts/rbac-shadow-go-no-go.ts
 */
import 'reflect-metadata';
import { AppDataSource } from '../src/database/datasource';

const SQL = `
WITH s AS (
  SELECT
    count(*) AS requests,
    count(DISTINCT endpoint) AS endpoints,
    count(DISTINCT resource) AS resources,
    count(DISTINCT role_slug) AS roles,
    count(DISTINCT tenant_id) AS tenants,
    count(*) FILTER (WHERE comparison_result='ALLOW_MATCH') AS allow_match,
    count(*) FILTER (WHERE comparison_result='DENY_MATCH') AS deny_match,
    count(*) FILTER (WHERE would_allow) AS would_allow,
    count(*) FILTER (WHERE would_deny) AS would_deny,
    count(*) FILTER (WHERE resolver_reason='resolver_error') AS resolver_divergence
  FROM rbac_decision_logs
),
xt AS (
  SELECT count(*) AS cross_tenant
  FROM rbac_decision_logs l
  JOIN roles r ON r.id = l.role_id
  WHERE r.tenant_id IS NOT NULL AND r.tenant_id <> l.tenant_id
)
SELECT s.*, xt.cross_tenant,
  CASE
    WHEN s.requests>=1000 AND s.endpoints>=10 AND s.roles>=5 AND s.tenants>=3
     AND s.would_allow=0 AND s.would_deny=0 AND xt.cross_tenant=0 AND s.resolver_divergence=0
    THEN 'APPROVED'
    ELSE 'REJECTED'
  END AS verdict
FROM s, xt;
`;

async function main() {
  const ds = AppDataSource;
  await ds.initialize();
  const reg = (await ds.query("SELECT to_regclass('public.rbac_decision_logs') AS t"))[0].t;
  if (!reg) { console.error('rbac_decision_logs DOES NOT EXIST — instrumentation missing.'); await ds.destroy(); process.exit(3); }
  const row = (await ds.query(SQL))[0];
  console.table([row]);
  const approved = row.verdict === 'APPROVED';
  console.log(`\nGO/NO-GO: ${row.verdict}  →  ${approved ? 'READY FOR ON' : 'KEEP SHADOW'}`);
  if (!approved) {
    console.log('Criteria not met (expected: requests≥1000, endpoints≥10, roles≥5, tenants≥3, would_allow=0, would_deny=0, cross_tenant=0, resolver_divergence=0).');
  }
  await ds.destroy();
  process.exit(approved ? 0 : 3);
}

main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1); });
