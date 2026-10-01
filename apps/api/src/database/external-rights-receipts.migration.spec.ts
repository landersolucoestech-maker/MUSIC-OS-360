import { BackfillExternalRightsReceiptsToCanonical20260930000017 as Migration } from './migrations/20260930000017_BackfillExternalRightsReceiptsToCanonical';
import { ALL_MIGRATIONS } from './migrations';
import { EXTERNAL_RIGHTS_RECEIPTS, LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE } from '../common/compat/external-rights-receipts';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('count(*)::int AS affected')) return [{ affected: 3 }];
    return [];
  });
  return { query, calls };
}

describe('BackfillExternalRightsReceiptsToCanonical20260930000017', () => {
  const migration = new Migration();

  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS (after 20260930000014, before the RBAC range)', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it('uses the same ids as the application code', () => {
    expect(EXTERNAL_RIGHTS_RECEIPTS).toBe('external_rights_receipts');
    expect(LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE).toBe('recebimentos externos de direitos');
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const { query } = runner({ bypass: false });
    await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up() sets lock_timeout, records the ids, then rewrites ONLY the exact phrase in the two columns', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[1].sql).toContain("SET LOCAL lock_timeout = '15s'");
    const updates = calls.filter((c) => c.sql.includes('WITH updated AS'));
    expect(updates.map((c) => c.params)).toEqual([
      [LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE, EXTERNAL_RIGHTS_RECEIPTS],
      [LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE, EXTERNAL_RIGHTS_RECEIPTS],
    ]);
    expect(updates[0].sql).toContain('UPDATE "contract_service_types" SET "financial_model" = $2 WHERE "financial_model" = $1');
    expect(updates[1].sql).toContain('UPDATE "transactions" SET "category" = $2 WHERE "category" = $1');
    for (const u of updates) expect(u.sql).not.toMatch(/lower\(|trim\(|ILIKE|LIKE|updated_at|IN \(/i);
    // the side-table INSERT precedes each UPDATE of the same table
    const idx = (needle: string) => calls.findIndex((c) => c.sql.includes(needle));
    expect(idx('INSERT INTO "external_rights_receipts_backfill_20260930"')).toBeLessThan(idx('UPDATE "contract_service_types"'));
    expect(calls.filter((c) => c.sql.includes('INSERT INTO "external_rights_receipts_backfill_20260930"'))).toHaveLength(2);
  });

  it('adds NO constraint, deletes nothing, never touches other categories, logs only counts', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    await migration.down({ query } as never);
    for (const c of calls) {
      expect(c.sql).not.toMatch(/ADD CONSTRAINT|CHECK\s*\(|DROP\s|DELETE\s|TRUNCATE/i);
    }
    const logs = (console.log as unknown as jest.Mock).mock.calls.map((a) => String(a[0]));
    for (const l of logs) expect(l).not.toContain(LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE);
  });

  it('the side table is locked down (RLS forced, no policy, revoked) and kept by down()', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const sql = calls.map((c) => c.sql).join('\n');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON TABLE "external_rights_receipts_backfill_20260930" FROM PUBLIC');
    expect(sql).not.toContain('CREATE POLICY');
    const down = runner();
    await migration.down({ query: down.query } as never);
    expect(down.calls.map((c) => c.sql).join('\n')).not.toMatch(/DROP TABLE/i);
  });

  it('down() restores the phrase only for recorded rows still holding the canonical id', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    const updates = calls.filter((c) => c.sql.includes('WITH updated AS'));
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      expect(u.params).toEqual([EXTERNAL_RIGHTS_RECEIPTS, LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE]);
      expect(u.sql).toContain('FROM "external_rights_receipts_backfill_20260930" l');
      expect(u.sql).toMatch(/x\."(financial_model|category)" = \$1/);
    }
  });
});
