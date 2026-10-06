import { CATALOG_INTEGRITY_CHECKS } from './catalog-integrity.checks';
import {
  CATALOG_INTEGRITY_ROW_CAP,
  CatalogIntegrityQueryable,
  formatCatalogIntegrityReport,
  runCatalogIntegrity,
} from './catalog-integrity.runner';

const WRITE_KEYWORD = /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|merge|call|do|vacuum)\b/i;

function fakeDb(handler: (sql: string, params?: unknown[]) => Array<Record<string, unknown>>) {
  const statements: string[] = [];
  const db: CatalogIntegrityQueryable = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      statements.push(sql);
      return { rows: handler(sql, params) };
    }),
  };
  return { db, statements };
}

describe('catalog integrity checks (definition)', () => {
  it('has unique ids and a description for each check', () => {
    const ids = CATALOG_INTEGRITY_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of CATALOG_INTEGRITY_CHECKS) expect(check.description.length).toBeGreaterThan(10);
  });

  it.each(CATALOG_INTEGRITY_CHECKS.map((c) => [c.id, c.sql] as const))('%s is one read-only SELECT with the tenant filter', (_id, sql) => {
    expect(sql.trim()).toMatch(/^SELECT\b/i);
    expect(sql).not.toContain(';');
    expect(sql).not.toMatch(WRITE_KEYWORD);
    expect(sql).toContain('$1::uuid');
    for (const column of ['tenant_id', 'entity_id', 'detail']) expect(sql).toContain(column);
  });

  it('covers the references the diagnostic promises: missing work, cross-tenant, mixed structure, duplicates', () => {
    const ids = CATALOG_INTEGRITY_CHECKS.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([
      'phonogram_work_missing', 'phonogram_work_cross_tenant', 'share_work_cross_tenant', 'share_phonogram_cross_tenant',
      'share_release_cross_tenant', 'share_mixed_structure', 'duplicate_work_iswc', 'duplicate_phonogram_isrc', 'duplicate_release_upc',
    ]));
  });
});

describe('runCatalogIntegrity', () => {
  it('runs everything inside a READ ONLY transaction that is rolled back, and never commits', async () => {
    const { db, statements } = fakeDb(() => []);
    await runCatalogIntegrity(db);
    expect(statements[0]).toBe('BEGIN READ ONLY');
    expect(statements[statements.length - 1]).toBe('ROLLBACK');
    expect(statements.some((s) => /^\s*COMMIT/i.test(s))).toBe(false);
    expect(statements).toHaveLength(CATALOG_INTEGRITY_CHECKS.length + 2);
  });

  it('rolls back when a check fails and lets the error through', async () => {
    const { db, statements } = fakeDb((sql) => {
      if (sql.includes('FROM phonograms p')) throw new Error('boom');
      return [];
    });
    await expect(runCatalogIntegrity(db)).rejects.toThrow('boom');
    expect(statements[statements.length - 1]).toBe('ROLLBACK');
  });

  it('passes the tenant filter to every check and reports null for all tenants', async () => {
    const { db } = fakeDb(() => []);
    await runCatalogIntegrity(db, { tenantId: 'tenant-1' });
    const calls = (db.query as jest.Mock).mock.calls.filter((c) => Array.isArray(c[1]));
    expect(calls.length).toBe(CATALOG_INTEGRITY_CHECKS.length);
    expect(calls.every((c) => (c[1] as unknown[])[0] === 'tenant-1')).toBe(true);
    const all = await runCatalogIntegrity(fakeDb(() => []).db);
    expect(all.tenantId).toBeNull();
  });

  it('counts errors and warnings separately and keeps the offending rows', async () => {
    const { db } = fakeDb((sql) => {
      if (sql.includes("'work_id=' || p.work_id AS detail")) return [{ tenant_id: 't1', entity_id: 'p1', detail: 'work_id=w1' }];
      if (sql.includes('archived work') || sql.includes('w.deleted_at IS NOT NULL AND')) return [{ tenant_id: 't1', entity_id: 's1', detail: 'work_id=w9' }];
      return [];
    });
    const report = await runCatalogIntegrity(db);
    expect(report.errors).toBe(1);
    expect(report.warnings).toBe(1);
    const missing = report.checks.find((c) => c.id === 'phonogram_work_missing');
    expect(missing).toMatchObject({ count: 1, truncated: false, findings: [{ tenantId: 't1', entityId: 'p1', detail: 'work_id=w1' }] });
  });

  it('marks a check that reached the row cap as truncated instead of cutting silently', async () => {
    const rows = Array.from({ length: CATALOG_INTEGRITY_ROW_CAP }, (_, i) => ({ tenant_id: 't', entity_id: `e${i}`, detail: 'd' }));
    const { db } = fakeDb((sql) => (sql.includes('FROM phonograms p') && sql.includes('NOT EXISTS') ? rows : []));
    const report = await runCatalogIntegrity(db);
    expect(report.checks.find((c) => c.id === 'phonogram_work_missing')).toMatchObject({ count: CATALOG_INTEGRITY_ROW_CAP, truncated: true });
  });

  it('accepts a plain row array result as well as a { rows } result', async () => {
    const db: CatalogIntegrityQueryable = {
      query: jest.fn(async (sql: string) => (sql.startsWith('SELECT') ? [{ tenant_id: 't', entity_id: 'e', detail: 'd' }] : [])),
    };
    const report = await runCatalogIntegrity(db, { checks: [CATALOG_INTEGRITY_CHECKS[0]] });
    expect(report.checks[0].count).toBe(1);
  });

  it('formats a report with FAIL and warn marks', async () => {
    const { db } = fakeDb((sql) => (sql.includes('NOT EXISTS (SELECT 1 FROM works w') ? [{ tenant_id: 't1', entity_id: 'p1', detail: 'work_id=w1' }] : []));
    const text = formatCatalogIntegrityReport(await runCatalogIntegrity(db));
    expect(text).toContain('1 error(s)');
    expect(text).toMatch(/FAIL phonogram_work_missing: 1/);
    expect(text).toContain('tenant t1 p1 work_id=w1');
    expect(text).toMatch(/ok {3}duplicate_release_upc: 0/);
  });
});
