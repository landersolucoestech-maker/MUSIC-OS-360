import { BackfillAndRestrictMarketingContentVocabularyToEnglish20260929000002 as Migration } from './migrations/20260929000002_BackfillAndRestrictMarketingContentVocabularyToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import {
  LEGACY_MARKETING_CONTENT_STATUSES,
  LEGACY_MARKETING_CONTENT_TARGET_TYPES,
  LEGACY_MARKETING_CONTENT_TYPES,
  MARKETING_CONTENT_STATUSES,
  MARKETING_CONTENT_TARGET_TYPES,
  MARKETING_CONTENT_TYPES,
} from '../modules/marketing/marketing-vocabulary';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean; invalid?: Record<string, string[]> } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('count(*)')) return [{ affected: 1 }];
    if (sql.includes('SELECT DISTINCT')) {
      const column = /SELECT DISTINCT "(\w+)"/.exec(sql)![1];
      return (opts.invalid?.[column] ?? []).map((value) => ({ value }));
    }
    return [];
  });
  return { query, calls };
}

const quotedList = (sql: string) => [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('BackfillAndRestrictMarketingContentVocabularyToEnglish20260929000002', () => {
  const migration = new Migration();

  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const { query } = runner({ bypass: false });
    await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up() backfills every legacy pair with bound parameters, verifies, then restricts (in that order)', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);

    const backfills = calls.filter((c) => c.sql.includes('WITH updated AS'));
    const expected = [
      ...Object.entries(LEGACY_MARKETING_CONTENT_STATUSES),
      ...Object.entries(LEGACY_MARKETING_CONTENT_TARGET_TYPES),
      ...Object.entries(LEGACY_MARKETING_CONTENT_TYPES),
    ];
    expect(backfills.map((c) => c.params)).toEqual(expected.map(([legacy, canonical]) => [legacy, canonical]));
    // updated_at is a concurrency token: the vocabulary rewrite must not touch it.
    for (const c of backfills) expect(c.sql).not.toContain('updated_at');

    const lastBackfill = calls.lastIndexOf(backfills[backfills.length - 1]);
    const firstVerify = calls.findIndex((c) => c.sql.includes('SELECT DISTINCT'));
    const firstAdd = calls.findIndex((c) => c.sql.includes('ADD CONSTRAINT'));
    const setDefault = calls.findIndex((c) => c.sql.includes(`SET DEFAULT 'scheduled'`));
    expect(lastBackfill).toBeLessThan(firstVerify);
    expect(firstVerify).toBeLessThan(setDefault);
    expect(setDefault).toBeLessThan(firstAdd);
  });

  it('the CHECK constraints allow exactly the API vocabulary', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const check = (name: string) => quotedList(calls.find((c) => c.sql.includes(`ADD CONSTRAINT "${name}"`))!.sql).sort();
    expect(check('chk_marketing_content_posts_status')).toEqual([...MARKETING_CONTENT_STATUSES].sort());
    expect(check('chk_marketing_content_posts_target_type')).toEqual([...MARKETING_CONTENT_TARGET_TYPES].sort());
    expect(check('chk_marketing_content_posts_content_type')).toEqual([...MARKETING_CONTENT_TYPES].sort());
  });

  it('up() aborts, listing the values, when a row holds a value with no canonical mapping (no constraint is added)', async () => {
    const { query, calls } = runner({ invalid: { status: ['ideia', 'atrasado'] } });
    await expect(migration.up({ query } as never)).rejects.toThrow(/marketing_content_posts"\."status".*\[ideia, atrasado\]/);
    expect(calls.some((c) => c.sql.includes('ADD CONSTRAINT'))).toBe(false);
  });

  it('down() drops the CHECKs, restores the old default and maps every canonical value back', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    expect(calls.filter((c) => c.sql.includes('DROP CONSTRAINT')).length).toBe(3);
    expect(calls.some((c) => c.sql.includes(`SET DEFAULT 'agendado'`))).toBe(true);
    const updates = calls.filter((c) => c.sql.startsWith('UPDATE "marketing_content_posts"')).map((c) => c.params);
    const expected = [
      ...Object.entries(LEGACY_MARKETING_CONTENT_STATUSES),
      ...Object.entries(LEGACY_MARKETING_CONTENT_TARGET_TYPES),
      ...Object.entries(LEGACY_MARKETING_CONTENT_TYPES),
    ];
    expect(updates).toEqual(expected.map(([legacy, canonical]) => [legacy, canonical]));
  });
});
