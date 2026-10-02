import {
  BackfillPhonogramDerivedFields20260930000038 as Migration,
  PHONOGRAM_DERIVED_FIELDS_BACKFILL,
  parseWellFormedDuration,
} from './migrations/20260930000038_BackfillPhonogramDerivedFields';
import { ALL_MIGRATIONS } from './migrations';
import { parseDurationTextToSeconds } from '../common/registry-fields/registry-fields.util';
import { fakeRunner, makeFakeDb, type FakeDb } from '../../test/helpers/jsonb-row-backfill.fake';

const { CONFLICT_TABLE } = PHONOGRAM_DERIVED_FIELDS_BACKFILL;
const ID = (n: number) => `aaaaaaaa-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const NO_PARTS = { isrc_country_code: null, isrc_registrant_code: null, isrc_year: null, isrc_designation_code: null };

const dataset = () => ({
  phonograms: [
    { id: ID(1), tenant_id: 't', duration_seconds: null, duration_text: '03:25', isrc: 'BRABC2600001', ...NO_PARTS, updated_at: 'U1' },
    { id: ID(2), tenant_id: 't', duration_seconds: 100, duration_text: '03:25', isrc: 'BRABC2600002', isrc_country_code: 'BR', isrc_registrant_code: 'ABC', isrc_year: '27', isrc_designation_code: null, updated_at: 'U2' },
    { id: ID(3), tenant_id: 't', duration_seconds: null, duration_text: 'garbage', isrc: 'invalid', ...NO_PARTS, updated_at: 'U3' },
    { id: ID(4), tenant_id: 't', duration_seconds: 60, duration_text: '01:00', isrc: 'BRABC2600004', isrc_country_code: 'BR', isrc_registrant_code: 'ABC', isrc_year: '26', isrc_designation_code: '00004', updated_at: 'U4' },
    { id: ID(5), tenant_id: 't', duration_seconds: null, duration_text: null, isrc: null, ...NO_PARTS, updated_at: 'U5' },
  ] as Array<Record<string, any>>,
});
const isCandidate = (_t: string, r: Record<string, unknown>) => r['duration_text'] != null || r['isrc'] != null;

function runner(db: FakeDb) {
  const base = fakeRunner(db, isCandidate);
  const conflicts: Array<{ id: string; group: string; stored: any; derived: any }> = [];
  return {
    conflicts,
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes(`INSERT INTO "${CONFLICT_TABLE}"`)) {
        const [id, , group, stored, derived] = params as string[];
        const at = conflicts.findIndex((c) => c.id === id && c.group === group);
        const entry = { id, group, stored: JSON.parse(stored), derived: JSON.parse(derived) };
        if (at >= 0) conflicts[at] = entry; else conflicts.push(entry);
        return [];
      }
      return base.query(sql, params);
    },
  };
}

describe('BackfillPhonogramDerivedFields20260930000038', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered after 37 and its frozen duration parser agrees with the application one on well-formed input', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    for (const text of ['03:25', '0:05', '62:03', '1:02:03']) expect(parseWellFormedDuration(text)).toBe(parseDurationTextToSeconds(text));
    expect(parseWellFormedDuration('garbage')).toBeNull();
    expect(parseWellFormedDuration('03:75')).toBeNull();
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('fills only NULL columns, never overwrites a disagreement, and logs it', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    const r = runner(db);
    await migration.up(r as never);
    const [a, b, c, d, e] = tables.phonograms;
    expect(a).toMatchObject({ duration_seconds: 205, duration_text: '03:25', isrc: 'BRABC2600001', isrc_country_code: 'BR', isrc_registrant_code: 'ABC', isrc_year: '26', isrc_designation_code: '00001', updated_at: 'U1' });
    // disagreement: duration_seconds 100 vs 03:25 and isrc_year 27 vs 26 -> nothing touched
    expect(b).toMatchObject({ duration_seconds: 100, isrc_year: '27', isrc_designation_code: null });
    expect(c).toMatchObject({ duration_seconds: null, isrc_country_code: null });
    expect(d).toMatchObject({ duration_seconds: 60, isrc_designation_code: '00004' });
    expect(e).toMatchObject({ duration_seconds: null, isrc: null });
    expect(r.conflicts.map((x) => `${x.id}:${x.group}`).sort()).toEqual([`${ID(2)}:duration`, `${ID(2)}:isrc`]);
    expect(r.conflicts.find((x) => x.group === 'duration')).toMatchObject({ stored: { duration_seconds: 100 }, derived: { duration_seconds: 205 } });
    expect(r.conflicts.find((x) => x.group === 'isrc')).toMatchObject({ derived: { isrc_year: '26' } });
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE/i);
    expect(db.log).toHaveLength(1);
  });

  it('is idempotent and down() restores the filled row exactly, keeping the side tables', async () => {
    const tables = dataset();
    const original = JSON.parse(JSON.stringify(tables)) as typeof tables;
    const db = makeFakeDb(tables as never);
    const r = runner(db);
    await migration.up(r as never);
    const updates = () => db.statements.filter((s) => s.sql.startsWith('UPDATE ')).length;
    const before = updates();
    await migration.up(r as never);
    expect(updates()).toBe(before);
    expect(r.conflicts).toHaveLength(2);
    await migration.down(r as never);
    expect(tables).toEqual(original);
    expect(db.statements.some((s) => /DROP TABLE/i.test(s.sql))).toBe(false);
  });

  it('down() never reverts a value edited after up()', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    const r = runner(db);
    await migration.up(r as never);
    tables.phonograms[0]['duration_seconds'] = 999;
    await migration.down(r as never);
    expect(tables.phonograms[0]['duration_seconds']).toBe(999);
  });
});
