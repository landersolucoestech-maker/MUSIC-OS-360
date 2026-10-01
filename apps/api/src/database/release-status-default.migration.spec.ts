import { BackfillReleaseStatusDefaultToDraft20260930000014 as Migration } from './migrations/20260930000014_BackfillReleaseStatusDefaultToDraft';
import { ALL_MIGRATIONS } from './migrations';
import { ReleaseStatus } from '@music-os-360/types';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('count(*)') && sql.includes('affected')) return [{ affected: 2 }];
    if (sql.includes('count(*)')) return [{ remaining: 0 }];
    return [];
  });
  return { query, calls };
}

describe('BackfillReleaseStatusDefaultToDraft20260930000014', () => {
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

  it('draft is the canonical ReleaseStatus the default and the backfill target', async () => {
    expect(ReleaseStatus.DRAFT).toBe('draft');
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[1].sql).toContain("SET LOCAL lock_timeout = '15s'");
    expect(calls.find((c) => c.sql.includes('SET DEFAULT'))!.sql).toContain(`SET DEFAULT '${ReleaseStatus.DRAFT}'`);
  });

  it("up() rewrites ONLY rows with exactly 'planejamento', keeps the legacy spelling in metadata, leaves updated_at alone", async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const update = calls.find((c) => c.sql.includes('WITH updated AS'))!;
    expect(update.params).toEqual(['planejamento', 'draft']);
    expect(update.sql).toContain(`"status" = $1`);
    expect(update.sql).not.toMatch(/lower\(|trim\(|updated_at|IN \(/i);
    expect(update.sql).toContain(`jsonb_build_object('legacy_status', COALESCE(NULLIF("metadata"->'legacy_status', 'null'::jsonb), to_jsonb("status")))`);
  });

  it('L6: an existing metadata.legacy_status is kept (first spelling wins), the new marker only fills a missing/null one', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const sql = calls.find((c) => c.sql.includes('WITH updated AS'))!.sql.replace(/\s+/g, ' ');
    // existing metadata first, then a legacy_status that is the EXISTING one unless it is absent/JSON null
    expect(sql).toContain(`COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('legacy_status', COALESCE(NULLIF("metadata"->'legacy_status', 'null'::jsonb), to_jsonb("status")))`);
  });

  it('does not decide or touch rejeitado / takedown / take_down / remocao, and adds no CHECK', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    await migration.down({ query } as never);
    for (const c of calls) {
      expect(c.sql).not.toMatch(/rejeitado|takedown|take_down|remocao|CONSTRAINT|DROP|DELETE/i);
      expect(JSON.stringify(c.params ?? [])).not.toMatch(/rejeitado|takedown|take_down|remocao/);
    }
  });

  it("down() restores the DEFAULT and only the rows that still hold 'draft' with the legacy marker", async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    expect(calls.find((c) => c.sql.includes('SET DEFAULT'))!.sql).toContain(`SET DEFAULT 'planejamento'`);
    const update = calls.find((c) => c.sql.startsWith('UPDATE "releases"'))!;
    expect(update.params).toEqual(['planejamento', 'draft']);
    expect(update.sql).toContain(`"metadata"->>'legacy_status' = $1`);
    expect(update.sql).toContain(`"status" = $2`);
  });
});
