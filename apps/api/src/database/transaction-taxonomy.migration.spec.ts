import { BackfillTransactionTaxonomyToEnglish20260930000018 as Migration } from './migrations/20260930000018_BackfillTransactionTaxonomyToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import {
  LEGACY_TRANSACTION_CATEGORY_SLUGS,
  CANONICAL_TRANSACTION_CATEGORY_SLUGS,
  UNCHANGED_TRANSACTION_CATEGORY_SLUGS,
  UNMAPPED_TRANSACTION_CATEGORY_SLUGS,
} from '../modules/transactions/transaction-category-slugs';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean; residue?: string[] } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('GROUP BY matched')) return [{ value: 'outros', affected: 3 }];
    if (sql.includes('count(*)::int AS affected')) return [{ affected: 2 }];
    if (sql.includes('"freeText"')) return [{ freeText: 5 }];
    if (sql.includes('SELECT DISTINCT')) return (opts.residue ?? []).map((value) => ({ value }));
    return [];
  });
  return { query, calls };
}

describe('BackfillTransactionTaxonomyToEnglish20260930000018', () => {
  const migration = new Migration();
  let log: jest.SpyInstance;

  beforeEach(() => { log = jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const { query } = runner({ bypass: false });
    await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('set equality with the code constants: the bound arrays ARE the API legacy map (same keys, same targets, same order)', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[1].sql).toContain("SET LOCAL lock_timeout = '15s'");
    const updates = calls.filter((c) => c.sql.includes('WITH updated AS'));
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      const [legacy, canonical] = u.params as [string[], string[]];
      expect(new Set(legacy)).toEqual(new Set(Object.keys(LEGACY_TRANSACTION_CATEGORY_SLUGS)));
      expect(legacy).toHaveLength(Object.keys(LEGACY_TRANSACTION_CATEGORY_SLUGS).length);
      expect(canonical).toEqual(legacy.map((l) => LEGACY_TRANSACTION_CATEGORY_SLUGS[l]));
      expect(new Set(canonical)).toEqual(new Set(CANONICAL_TRANSACTION_CATEGORY_SLUGS));
    }
    // every target of the map is a canonical id and the unmapped/unchanged slugs are NOT in the map
    const keys = new Set(Object.keys(LEGACY_TRANSACTION_CATEGORY_SLUGS));
    for (const slug of [...UNMAPPED_TRANSACTION_CATEGORY_SLUGS, ...UNCHANGED_TRANSACTION_CATEGORY_SLUGS]) expect(keys.has(slug)).toBe(false);
  });

  it('up() records first, then rewrites category and subcategory by EXACT match only; updated_at untouched', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const idx = (needle: string, from = 0) => calls.findIndex((c, i) => i >= from && c.sql.includes(needle));
    const insertCategory = idx('INSERT INTO "transaction_taxonomy_backfill_20260930"');
    const updateCategory = idx('UPDATE "transactions" AS t SET "category"');
    const updateSub = idx('UPDATE "transactions" AS t SET "subcategory"');
    expect(insertCategory).toBeGreaterThan(-1);
    expect(insertCategory).toBeLessThan(updateCategory);
    expect(updateCategory).toBeLessThan(updateSub);
    expect(calls.filter((c) => c.sql.includes('INSERT INTO "transaction_taxonomy_backfill_20260930"'))).toHaveLength(2);
    for (const c of calls.filter((x) => x.sql.includes('UPDATE "transactions"'))) {
      expect(c.sql).toMatch(/t\."(category|subcategory)" = m\.legacy/);
      expect(c.sql).not.toMatch(/lower\(|trim\(|ILIKE|LIKE |updated_at/i);
    }
  });

  it('adds NO constraint (S11 blocked), drops/deletes nothing, never touches other tables or the CT1 phrase', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    await migration.down({ query } as never);
    for (const c of calls) {
      expect(c.sql).not.toMatch(/ADD CONSTRAINT|CHECK\s*\(|DROP\s|DELETE\s|TRUNCATE|ALTER TABLE "transactions"/i);
      expect(c.sql).not.toMatch(/financial_categories|finance_category_keyword_rules/);
    }
    expect(Object.keys(LEGACY_TRANSACTION_CATEGORY_SLUGS)).not.toContain('recebimentos externos de direitos');
  });

  it('logs are bounded: at most 20 listed values truncated to 40 chars; residue is reported, never aborts', async () => {
    const residue = Array.from({ length: 21 }, (_, i) => `x${i}-${'a'.repeat(60)}`);
    const { query } = runner({ residue });
    await expect(migration.up({ query } as never)).resolves.toBeUndefined();
    const lines = log.mock.calls.map((a) => String(a[0]));
    const line = lines.find((l) => l.includes('outside the known sets'))!;
    expect(line).toContain('more not shown');
    expect(line).not.toContain('a'.repeat(41));
    expect(line).toContain('free-text rows (left untouched): 5');
  });

  it('the side table is locked down (RLS forced, no policy, revoked) and kept by down()', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const sql = calls.map((c) => c.sql).join('\n');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON TABLE "transaction_taxonomy_backfill_20260930" FROM PUBLIC');
    expect(sql).not.toContain('CREATE POLICY');
    const down = runner();
    await migration.down({ query: down.query } as never);
    expect(down.calls.map((c) => c.sql).join('\n')).not.toMatch(/DROP TABLE/i);
  });

  it('down() restores the recorded legacy value only for rows still holding exactly the canonical value written by up()', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    const updates = calls.filter((c) => c.sql.includes('WITH updated AS'));
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      expect(u.sql).toContain('FROM "transaction_taxonomy_backfill_20260930" l');
      expect(u.sql).toMatch(/t\."(category|subcategory)" = l\."canonical_value"/);
      expect(u.sql).toContain('SET "' + (u.sql.includes('"subcategory" = l."legacy_value"') ? 'subcategory' : 'category') + '" = l."legacy_value"');
    }
  });
});
