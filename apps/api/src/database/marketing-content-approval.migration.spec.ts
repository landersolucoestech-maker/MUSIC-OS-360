import { BackfillAndRestrictMarketingContentApprovalToEnglish20260930000003 as Migration } from './migrations/20260930000003_BackfillAndRestrictMarketingContentApprovalToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import {
  LEGACY_MARKETING_CONTENT_APPROVALS,
  MARKETING_CONTENT_APPROVALS,
} from '../modules/marketing/marketing-vocabulary';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean; invalid?: string[]; unmappable?: string[] } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('count(*)')) return [{ affected: 1 }];
    if (sql.includes('SELECT DISTINCT')) {
      // up() verifies against the canonical set only; down() against canonical + legacy.
      const rows = sql.includes("'pendente'") ? opts.unmappable : opts.invalid;
      return (rows ?? []).map((value) => ({ value }));
    }
    return [];
  });
  return { query, calls };
}

const quotedList = (sql: string) => [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('BackfillAndRestrictMarketingContentApprovalToEnglish20260930000003', () => {
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
    expect(backfills.map((c) => c.params)).toEqual(
      Object.entries(LEGACY_MARKETING_CONTENT_APPROVALS).map(([legacy, canonical]) => [legacy, canonical]),
    );
    for (const c of backfills) {
      // updated_at is a concurrency token: the vocabulary rewrite must not touch it.
      expect(c.sql).not.toContain('updated_at');
      // Only string approvals are rewritten, and only that one key of the jsonb.
      expect(c.sql).toContain("jsonb_typeof(\"metadata\"->'approval') = 'string'");
      expect(c.sql).toContain("jsonb_set(\"metadata\", '{approval}'");
    }

    const lastBackfill = calls.lastIndexOf(backfills[backfills.length - 1]);
    const verify = calls.findIndex((c) => c.sql.includes('SELECT DISTINCT'));
    const add = calls.findIndex((c) => c.sql.includes('ADD CONSTRAINT'));
    const validate = calls.findIndex((c) => c.sql.includes('VALIDATE CONSTRAINT'));
    expect(lastBackfill).toBeLessThan(verify);
    expect(verify).toBeLessThan(add);
    expect(validate).toBe(-1); // plain ADD CONSTRAINT: no NOT VALID + VALIDATE ceremony
    expect(calls[add].sql).not.toContain('NOT VALID');
  });

  it('the CHECK allows exactly the API vocabulary, and a missing key / JSON null', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const add = calls.find((c) => c.sql.includes('ADD CONSTRAINT "chk_marketing_content_posts_metadata_approval"'))!;
    expect(quotedList(add.sql).filter((v) => v !== 'approval').sort()).toEqual([...MARKETING_CONTENT_APPROVALS].sort());
    expect(add.sql).toContain(`("metadata"->>'approval') IS NULL`);
  });

  it('up() aborts, listing the values, when a row holds an approval with no canonical mapping (no constraint is added)', async () => {
    const { query, calls } = runner({ invalid: ['unknown_value', '3'] });
    await expect(migration.up({ query } as never)).rejects.toThrow(/metadata"->>'approval' contains unexpected values after backfill: \[unknown_value, 3\]/);
    expect(calls.some((c) => c.sql.includes('ADD CONSTRAINT'))).toBe(false);
  });

  it('abort messages are bounded: max 20 values, each <= 40 chars, single line', async () => {
    const hostile = ['x'.repeat(500), 'line1\nline2\r\nline3', ...Array.from({ length: 30 }, (_, i) => `v${i}`)];
    const { query } = runner({ invalid: hostile });
    const error = await migration.up({ query } as never).then(
      () => new Error('did not throw'),
      (e: Error) => e,
    );
    expect(error.message).not.toMatch(/[\r\n]/);
    expect(error.message).not.toContain('x'.repeat(41));
    expect(error.message).toContain('line1 line2 line3');
    expect(error.message).toContain('v17');
    expect(error.message).not.toContain('v18');
    expect(error.message).toContain('(+12 more)');
  });

  it('down() abort message is bounded the same way', async () => {
    const { query } = runner({ unmappable: ['y'.repeat(500)] });
    const error = await migration.down({ query } as never).then(
      () => new Error('did not throw'),
      (e: Error) => e,
    );
    expect(error.message).not.toContain('y'.repeat(41));
    expect(error.message).toContain('y'.repeat(40) + '...');
  });

  it('up() and down() SELECT DISTINCT queries are LIMITed', async () => {
    const up = runner();
    await migration.up({ query: up.query } as never);
    const down = runner();
    await migration.down({ query: down.query } as never);
    for (const c of [...up.calls, ...down.calls].filter((x) => x.sql.includes('SELECT DISTINCT'))) {
      expect(c.sql).toContain('LIMIT 21');
    }
  });

  it('down() refuses, before touching anything, when a row holds an unrepresentable approval', async () => {
    const { query, calls } = runner({ unmappable: ['maybe'] });
    await expect(migration.down({ query } as never)).rejects.toThrow(/neither canonical nor legacy: \[maybe\]/);
    expect(calls.some((c) => c.sql.includes('DROP CONSTRAINT'))).toBe(false);
    expect(calls.some((c) => c.sql.startsWith('UPDATE'))).toBe(false);
  });

  it('down() drops the CHECK and maps every canonical value back, without touching updated_at', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    expect(calls.filter((c) => c.sql.includes('DROP CONSTRAINT')).length).toBe(1);
    const updates = calls.filter((c) => c.sql.startsWith('UPDATE "marketing_content_posts"'));
    expect(updates.map((c) => c.params)).toEqual(
      Object.entries(LEGACY_MARKETING_CONTENT_APPROVALS).map(([legacy, canonical]) => [legacy, canonical]),
    );
    for (const c of updates) expect(c.sql).not.toContain('updated_at');
  });
});
