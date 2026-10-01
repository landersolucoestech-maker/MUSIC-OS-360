import {
  BackfillProjectTrackInstrumentalAndLanguageToEnglish20260930000032 as Migration,
  PROJECT_TRACK_BACKFILL_MAPS,
  canonicalProjectTrackRowForBackfill,
} from './migrations/20260930000032_BackfillProjectTrackInstrumentalAndLanguageToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { LEGACY_PROJECT_TRACK_INSTRUMENTAL, LEGACY_PROJECT_TRACK_LANGUAGE } from '../modules/projects/project-track-vocabulary';
import { fakeRunner, makeFakeDb, type Row } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const isCandidate = (_t: string, r: Row) => String(r['instrumental']) in PROJECT_TRACK_BACKFILL_MAPS.INSTRUMENTAL || String(r['language']) in PROJECT_TRACK_BACKFILL_MAPS.LANGUAGE;

const dataset = () => ({
  project_tracks: [
    { id: ID(1), tenant_id: 't', name: 'sim', instrumental: 'sim', language: 'portugues', updated_at: 'U1' },
    { id: ID(2), tenant_id: 't', name: 'b', instrumental: 'nao', language: 'chines-mandarim', updated_at: 'U2' },
    { id: ID(3), tenant_id: 't', name: 'c', instrumental: 'yes', language: 'pt', updated_at: 'U3' },
    { id: ID(4), tenant_id: 't', name: 'd', instrumental: null, language: 'Dialeto local', updated_at: 'U4' },
    { id: ID(5), tenant_id: 't', name: 'e', instrumental: 'Sim', language: 'pt-BR', updated_at: 'U5' }, // not exact: untouched
    { id: ID(6), tenant_id: 't', name: 'f', instrumental: 'não', language: null, updated_at: 'U6' },
  ] as Array<Record<string, any>>,
});

describe('BackfillProjectTrackInstrumentalAndLanguageToEnglish20260930000032', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and its frozen maps equal the application maps', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    expect(PROJECT_TRACK_BACKFILL_MAPS).toEqual({ INSTRUMENTAL: LEGACY_PROJECT_TRACK_INSTRUMENTAL, LANGUAGE: LEGACY_PROJECT_TRACK_LANGUAGE });
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites exact legacy values only, keeps every other column, never touches updated_at', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    const t = tables.project_tracks;
    expect(t[0]).toMatchObject({ instrumental: 'yes', language: 'pt', name: 'sim' });
    expect(t[1]).toMatchObject({ instrumental: 'no', language: 'zh' });
    expect(t[2]).toMatchObject({ instrumental: 'yes', language: 'pt' });
    expect(t[3]).toMatchObject({ instrumental: null, language: 'Dialeto local' });
    expect(t[4]).toMatchObject({ instrumental: 'Sim', language: 'pt-BR' });
    expect(t[5]).toMatchObject({ instrumental: 'no', language: null });
    for (const row of t) expect(String(row['updated_at'])).toMatch(/^U/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log.map((l) => l.id).sort()).toEqual([ID(1), ID(2), ID(6)]);
    expect(db.log.find((l) => l.id === ID(6))).toMatchObject({ before: { instrumental: 'não' }, after: { instrumental: 'no' } });
  });

  it('is idempotent; down() restores BEFORE exactly for untouched rows; logs are counts only', async () => {
    const tables = dataset();
    const original = JSON.parse(JSON.stringify(tables)) as typeof tables;
    const db = makeFakeDb(tables as never);
    const runner = fakeRunner(db, isCandidate);
    await migration.up(runner as never);
    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE ')).length;
    const before = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(before);
    tables.project_tracks[1].language = 'fr'; // edited since up()
    await migration.down(runner as never);
    expect(tables.project_tracks[0]).toEqual(original.project_tracks[0]);
    expect(tables.project_tracks[5]).toEqual(original.project_tracks[5]);
    expect(tables.project_tracks[1].language).toBe('fr');
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/portugues|chines|sim\b/);
  });

  it('transform returns null for canonical and free text rows', () => {
    expect(canonicalProjectTrackRowForBackfill({ instrumental: 'yes', language: 'en' })).toBeNull();
    expect(canonicalProjectTrackRowForBackfill({ instrumental: null, language: 'Dialeto' })).toBeNull();
  });
});
