import { BackfillCanonicalFromLegacyMirrors20260930000022 as Migration } from './migrations/20260930000022_BackfillCanonicalFromLegacyMirrors';
import { ALL_MIGRATIONS } from './migrations';

type Call = { sql: string; params?: unknown[] };

function runner(counts: { invoices?: number; takedowns?: number; bypass?: boolean; urlColumn?: boolean; tablesGone?: boolean } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: counts.bypass ?? true }];
    if (sql.includes('to_regclass')) return [{ t: counts.tablesGone ? null : 'tracking' }];
    if (sql.includes('information_schema.columns')) return (counts.urlColumn ?? true) ? [{ ok: 1 }] : [];
    if (sql.includes('WITH moved AS') && sql.includes('"invoices"')) return [{ n: counts.invoices ?? 3 }];
    if (sql.includes('WITH moved AS') && sql.includes('"takedowns"')) return [{ n: counts.takedowns ?? 2 }];
    if (sql.includes('count(*)::int AS n')) return [{ n: 0 }];
    return [];
  });
  return { query, calls };
}

describe('BackfillCanonicalFromLegacyMirrors20260930000022 (LC1 expand, no drop)', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it('up(): guard first, lock_timeout second, tracking tables locked down BEFORE any UPDATE', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[0].sql).toContain('rolbypassrls');
    expect(calls[1].sql).toContain(`SET LOCAL lock_timeout = '15s'`);
    const firstUpdate = calls.findIndex((c) => /UPDATE "(invoices|takedowns)"/.test(c.sql));
    for (const table of ['invoices_service_amount_backfill_20260930', 'takedowns_infringing_url_backfill_20260930']) {
      const created = calls.findIndex((c) => c.sql.includes(`CREATE TABLE IF NOT EXISTS "${table}"`));
      expect(created).toBeGreaterThan(1);
      expect(created).toBeLessThan(firstUpdate);
      expect(calls.some((c) => c.sql.includes(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`))).toBe(true);
      expect(calls.some((c) => c.sql.includes(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`))).toBe(true);
      expect(calls.some((c) => c.sql.includes(`REVOKE ALL ON TABLE "${table}" FROM PUBLIC`))).toBe(true);
      expect(calls.some((c) => c.sql.includes(`'${table}'`) && c.sql.includes('REVOKE ALL ON TABLE public.%I'))).toBe(true);
    }
  });

  it('up(): only fills NULL canonical values (never overwrites) and records ids in the same statement', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const invoices = calls.find((c) => c.sql.includes('UPDATE "invoices"'))!.sql;
    expect(invoices).toContain('SET "service_amount" = "legacy_amount"');
    expect(invoices).toContain('"service_amount" IS NULL AND "legacy_amount" IS NOT NULL');
    expect(invoices).toContain('INSERT INTO "invoices_service_amount_backfill_20260930"');
    const takedowns = calls.find((c) => c.sql.includes('UPDATE "takedowns"'))!.sql;
    expect(takedowns).toContain('SET "infringing_url" = "url"');
    expect(takedowns).toContain('"infringing_url" IS NULL AND "url" IS NOT NULL');
    expect(takedowns).toContain('INSERT INTO "takedowns_infringing_url_backfill_20260930"');
  });

  it('up(): never drops or alters a column and never touches updated_at', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const all = calls.map((c) => c.sql).join('\n');
    expect(all).not.toMatch(/DROP\s+(COLUMN|TABLE)|ALTER TABLE "(invoices|takedowns)"|RENAME|updated_at/i);
  });

  it('up(): reports counts only (no values) and does not throw on divergence', async () => {
    const { query } = runner({ invoices: 4, takedowns: 1 });
    await migration.up({ query } as never);
    const log = String((console.log as jest.Mock).mock.calls[0][0]);
    expect(log).toContain('invoices.service_amount filled: 4 row(s)');
    expect(log).toContain('takedowns.infringing_url filled: 1 row(s)');
  });

  it('down(): reverts only the recorded ids that still equal the mirror, then drops the side tables', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    expect(calls[0].sql).toContain('rolbypassrls');
    expect(calls[1].sql).toContain(`SET LOCAL lock_timeout = '15s'`);
    const all = calls.map((c) => c.sql).join('\n');
    expect(all).toContain('UPDATE "invoices" i SET "service_amount" = NULL');
    expect(all).toContain('i."service_amount" IS NOT DISTINCT FROM i."legacy_amount"');
    expect(all).toContain('UPDATE "takedowns" t SET "infringing_url" = NULL');
    expect(all).toContain('t."infringing_url" IS NOT DISTINCT FROM t."url"');
    const lastUpdate = calls.map((c) => c.sql).lastIndexOf(calls.filter((c) => c.sql.includes('UPDATE "takedowns"'))[0].sql);
    const firstDrop = calls.findIndex((c) => c.sql.includes('DROP TABLE IF EXISTS'));
    expect(firstDrop).toBeGreaterThan(lastUpdate);
    expect(all).not.toMatch(/DROP COLUMN/i);
  });

  it('refuses to run without a BYPASSRLS role (up and down stop at the guard)', async () => {
    for (const direction of ['up', 'down'] as const) {
      const { query } = runner({ bypass: false });
      await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
      expect(query).toHaveBeenCalledTimes(1);
    }
  });
  it('skips the takedowns mirror (up and down) when takedowns.url no longer exists', async () => {
    const { query, calls } = runner({ urlColumn: false });
    await migration.up({ query } as never);
    await migration.down({ query } as never);
    const all = calls.map((c) => c.sql).join('\n');
    expect(all).toContain('information_schema.columns');
    expect(all).not.toContain('UPDATE "takedowns"');
    expect(all).not.toContain('"url"');
    expect(all).toContain('UPDATE "invoices"');
  });

  it('SEC3 F-MG3: a second down() (tracking tables already gone) does not run any UPDATE and does not fail', async () => {
    const { query, calls } = runner({ tablesGone: true });
    await expect(migration.down({ query } as never)).resolves.toBeUndefined();
    const all = calls.map((c) => c.sql).join('\n');
    expect(all).toContain('to_regclass');
    expect(all).not.toMatch(/UPDATE "(invoices|takedowns)"/);
    expect(all).toContain('DROP TABLE IF EXISTS');
  });
});
