import { CATALOG_INTEGRITY_CHECKS, CatalogIntegrityCheck, CatalogIntegritySeverity } from './catalog-integrity.checks';

/** The part of a pg Client / DataSource query runner the diagnostic needs. */
export interface CatalogIntegrityQueryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>;
}

export interface CatalogIntegrityFinding {
  tenantId: string;
  entityId: string;
  detail: string;
}

export interface CatalogIntegrityCheckResult {
  id: string;
  severity: CatalogIntegritySeverity;
  description: string;
  count: number;
  /** True when the check returned the row cap: more offending rows may exist. */
  truncated: boolean;
  findings: CatalogIntegrityFinding[];
}

export interface CatalogIntegrityReport {
  tenantId: string | null;
  errors: number;
  warnings: number;
  checks: CatalogIntegrityCheckResult[];
}

/** Rows kept per check; a wider breakage is reported as truncated, never silently cut. */
export const CATALOG_INTEGRITY_ROW_CAP = 500;

const rowsOf = (result: Awaited<ReturnType<CatalogIntegrityQueryable['query']>>): Array<Record<string, unknown>> =>
  Array.isArray(result) ? result : result.rows;

/**
 * Runs every check against the database and reports what it finds. The whole run is one READ ONLY transaction that is
 * always rolled back: PostgreSQL itself rejects any write, so the diagnostic cannot change data even if a check were
 * edited into a write statement.
 */
export async function runCatalogIntegrity(
  db: CatalogIntegrityQueryable,
  options: { tenantId?: string | null; checks?: readonly CatalogIntegrityCheck[] } = {},
): Promise<CatalogIntegrityReport> {
  const tenantId = options.tenantId ?? null;
  const checks = options.checks ?? CATALOG_INTEGRITY_CHECKS;
  const results: CatalogIntegrityCheckResult[] = [];
  await db.query('BEGIN READ ONLY');
  try {
    for (const check of checks) {
      const rows = rowsOf(await db.query(`${check.sql} ORDER BY 1, 2 LIMIT ${CATALOG_INTEGRITY_ROW_CAP}`, [tenantId]));
      const findings = rows.map((row) => ({
        tenantId: String(row['tenant_id']),
        entityId: String(row['entity_id']),
        detail: String(row['detail']),
      }));
      results.push({
        id: check.id,
        severity: check.severity,
        description: check.description,
        count: findings.length,
        truncated: findings.length >= CATALOG_INTEGRITY_ROW_CAP,
        findings,
      });
    }
  } finally {
    await db.query('ROLLBACK');
  }
  return {
    tenantId,
    errors: results.filter((r) => r.severity === 'error').reduce((sum, r) => sum + r.count, 0),
    warnings: results.filter((r) => r.severity === 'warning').reduce((sum, r) => sum + r.count, 0),
    checks: results,
  };
}

/** Human-readable report; one line per check, then the offending rows. */
export function formatCatalogIntegrityReport(report: CatalogIntegrityReport): string {
  const lines = [`catalog integrity (${report.tenantId ?? 'all tenants'}): ${report.errors} error(s), ${report.warnings} warning(s)`];
  for (const check of report.checks) {
    const mark = check.count === 0 ? 'ok  ' : check.severity === 'error' ? 'FAIL' : 'warn';
    lines.push(`  ${mark} ${check.id}: ${check.count}${check.truncated ? '+' : ''} — ${check.description}`);
    for (const finding of check.findings.slice(0, 20)) {
      lines.push(`       tenant ${finding.tenantId} ${finding.entityId} ${finding.detail}`);
    }
  }
  return lines.join('\n');
}
