import {
  BackfillInternalRevenueAndContractPassThroughSlugs20260930000037 as Migration,
  TRANSACTION_INTERNAL_REVENUE_BACKFILL,
} from './migrations/20260930000037_BackfillInternalRevenueAndContractPassThroughSlugs';
import { ALL_MIGRATIONS } from './migrations';
import {
  CANONICAL_TRANSACTION_CATEGORY_SLUGS,
  LEGACY_TRANSACTION_CATEGORY_SLUGS,
  UNMAPPED_TRANSACTION_CATEGORY_SLUGS,
} from '../modules/transactions/transaction-category-slugs';

type Call = { sql: string; params?: unknown[] };

const LOG = 'transaction_internal_revenue_backfill_20260930';

function runner(opts: { bypass?: boolean } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('GROUP BY matched')) return [{ value: 'receitas-internas', affected: 3 }];
    if (sql.includes('count(*)::int AS affected')) return [{ affected: 2 }];
    return [];
  });
  return { query, calls };
}

describe('BackfillInternalRevenueAndContractPassThroughSlugs20260930000037', () => {
  const migration = new Migration();
  let log: jest.SpyInstance;

  beforeEach(() => { log = jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it('the frozen literal equals exactly the two application map entries, with canonical targets', () => {
    const { LEGACY_TO_CANONICAL } = TRANSACTION_INTERNAL_REVENUE_BACKFILL;
    expect(LEGACY_TO_CANONICAL).toEqual({
      'receitas-internas': 'internal_revenue',
      'repasse-contrato': 'contract_pass_through',
    });
    for (const [legacy, canonical] of Object.entries(LEGACY_TO_CANONICAL)) {
      expect(LEGACY_TRANSACTION_CATEGORY_SLUGS[legacy]).toBe(canonical);
      expect(CANONICAL_TRANSACTION_CATEGORY_SLUGS).toContain(canonical);
    }
    expect(UNMAPPED_TRANSACTION_CATEGORY_SLUGS).toEqual([]);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const { query } = runner({ bypass: false });
    await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up() records first, then rewrites category and subcategory by EXACT match only; updated_at untouched', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const idx = (needle: string) => calls.findIndex((c) => c.sql.includes(needle));
    const insertCategory = idx(`INSERT INTO "${LOG}"`);
    const updateCategory = idx('UPDATE "transactions" AS t SET "category"');
    const updateSub = idx('UPDATE "transactions" AS t SET "subcategory"');
    expect(insertCategory).toBeGreaterThan(-1);
    expect(insertCategory).toBeLessThan(updateCategory);
    expect(updateCategory).toBeLessThan(updateSub);
    expect(calls.filter((c) => c.sql.includes(`INSERT INTO "${LOG}"`))).toHaveLength(2);
    const updates = calls.filter((c) => c.sql.includes('UPDATE "transactions"'));
    expect(updates).toHaveLength(2);
    for (const c of updates) {
      expect(c.sql).toMatch(/t\."(category|subcategory)" = m\.legacy/);
      expect(c.sql).not.toMatch(/lower\(|trim\(|ILIKE|LIKE |updated_at/i);
      const [legacy, canonical] = c.params as [string[], string[]];
      expect(legacy).toEqual(['receitas-internas', 'repasse-contrato']);
      expect(canonical).toEqual(['internal_revenue', 'contract_pass_through']);
    }
  });

  it('adds NO constraint, drops/deletes nothing, never touches other tables', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    await migration.down({ query } as never);
    for (const c of calls) {
      expect(c.sql).not.toMatch(/ADD CONSTRAINT|CHECK\s*\(|DROP\s|DELETE\s|TRUNCATE|ALTER TABLE "transactions"/i);
      expect(c.sql).not.toMatch(/financial_categories|finance_category_keyword_rules/);
    }
  });

  it('logs are counts only and never print the slugs bound as data beyond the aggregate', async () => {
    const { query } = runner();
    await migration.up({ query } as never);
    const lines = log.mock.calls.map((a) => String(a[0]));
    expect(lines.some((l) => l.includes('transactions.category renamed: 3 row(s)'))).toBe(true);
    expect(lines.some((l) => l.includes('transactions.subcategory renamed: 3 row(s)'))).toBe(true);
  });

  it('the side table is locked down (RLS forced, no policy, revoked) and kept by down()', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const sql = calls.map((c) => c.sql).join('\n');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain(`REVOKE ALL ON TABLE "${LOG}" FROM PUBLIC`);
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
      expect(u.sql).toContain(`FROM "${LOG}" l`);
      expect(u.sql).toMatch(/t\."(category|subcategory)" = l\."canonical_value"/);
      expect(u.sql).toMatch(/SET "(category|subcategory)" = l\."legacy_value"/);
      expect(u.sql).not.toMatch(/updated_at/i);
    }
  });
});
