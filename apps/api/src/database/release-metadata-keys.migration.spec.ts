import { BackfillReleaseMetadataKeysToEnglish20260930000019 as Migration, canonicalReleaseMetadataForBackfill } from './migrations/20260930000019_BackfillReleaseMetadataKeysToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { canonicalizeReleaseMetadata, RELEASE_METADATA_KEY_RENAMES, RELEASE_TRACK_KEY_RENAMES, RELEASE_CREDIT_ENTRY_KEY_RENAMES } from '../common/compat/release-metadata';
import { fakeRunner, makeFakeDb } from './jsonb-row-backfill.fake';

const legacyMeta = () => ({
  keep: { automation: true },
  variosArtistas: true,
  generoSecundario: 'Samba',
  artistasAdicionaisAlbum: [{ nome: 'F', role: 'Featuring' }],
  faixas: [{ title: 't', artista: 'X', tipoVersao: 'remix', compositores: ['a'], musicos: [{ nome: 'M', instrumento: 'guitar' }], letra: 'olá' }],
});
const hasLegacy = (m: unknown) => Object.keys(RELEASE_METADATA_KEY_RENAMES).some((k) => Object.prototype.hasOwnProperty.call(m, k));

function setup(rows: Array<Record<string, unknown>>) {
  const db = makeFakeDb({ releases: rows });
  return { db, runner: fakeRunner(db, (_t, r) => hasLegacy(r['metadata'] as object)) };
}

describe('BackfillReleaseMetadataKeysToEnglish20260930000019', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb({ releases: [] }, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('its rename tables are exactly the application ones (the migration is frozen, the app maps may shrink at the contract step)', () => {
    const sample = {
      ...Object.fromEntries(Object.keys(RELEASE_METADATA_KEY_RENAMES).map((k) => [k, k === 'faixas' ? [] : 1])),
    } as Record<string, unknown>;
    sample['faixas'] = [Object.fromEntries(Object.keys(RELEASE_TRACK_KEY_RENAMES).map((k) => [k, ['musicos', 'produtores', 'artistasAdicionais'].includes(k) ? [Object.fromEntries(Object.keys(RELEASE_CREDIT_ENTRY_KEY_RENAMES).map((e) => [e, 'v']))] : 'v']))];
    expect(canonicalReleaseMetadataForBackfill(sample).value).toEqual(canonicalizeReleaseMetadata(sample).value);
  });

  it('rewrites the keys, preserves everything else, skips canonical rows, is idempotent and guarded', async () => {
    const canonicalRow = { id: '00000000-0000-0000-0000-000000000002', tenant_id: 't', metadata: { variousArtists: true, tracks: [] } };
    const legacyRow = { id: '00000000-0000-0000-0000-000000000001', tenant_id: 't', metadata: legacyMeta() };
    const { db, runner } = setup([canonicalRow, legacyRow]);
    await migration.up(runner as never);

    expect(db.tables.releases[1].metadata).toEqual({
      keep: { automation: true },
      variousArtists: true,
      secondaryGenre: 'Samba',
      additionalAlbumArtists: [{ name: 'F', role: 'Featuring' }],
      tracks: [{ title: 't', artist: 'X', versionType: 'remix', composers: ['a'], musicians: [{ name: 'M', instrument: 'guitar' }], lyrics: 'olá' }],
    });
    expect(db.tables.releases[0]).toEqual(canonicalRow);
    expect(db.log).toHaveLength(1);
    expect(db.log[0].before).toEqual({ metadata: legacyMeta() });

    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE "releases"')).length;
    expect(writes()).toBe(1);
    await migration.up(runner as never); // idempotent: nothing left to rewrite
    expect(writes()).toBe(1);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE/i);
    // the UPDATE is guarded by the value that was read
    expect(db.statements.find((s) => s.sql.startsWith('UPDATE "releases"'))!.sql).toContain('"metadata" = $3::jsonb');
  });

  it('both spellings present: canonical wins, conflict is logged as a count only', async () => {
    const row = { id: '00000000-0000-0000-0000-000000000001', tenant_id: 't', metadata: { variosArtistas: true, variousArtists: false } };
    const { db, runner } = setup([row]);
    await migration.up(runner as never);
    expect(db.tables.releases[0].metadata).toEqual({ variousArtists: false });
    const logs = (console.log as unknown as jest.Mock).mock.calls.map((a) => String(a[0]));
    expect(logs.some((l) => /1 key conflict/.test(l))).toBe(true);
    for (const l of logs) expect(l).not.toMatch(/true|false|Samba/);
  });

  it('a row edited concurrently (guard mismatch) is skipped, not overwritten', async () => {
    const row = { id: '00000000-0000-0000-0000-000000000001', tenant_id: 't', metadata: legacyMeta() };
    const { db } = setup([row]);
    const base = fakeRunner(db, (_t, r) => hasLegacy(r['metadata'] as object));
    const query = async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('UPDATE "releases"')) row.metadata = { ...row.metadata, edited: true } as never; // user edit between read and write
      return base.query(sql, params);
    };
    await migration.up({ query } as never);
    expect((row.metadata as Record<string, unknown>)['edited']).toBe(true);
    expect((row.metadata as Record<string, unknown>)['faixas']).toBeDefined();
  });

  it('down() restores BEFORE only for rows still holding AFTER', async () => {
    const a = { id: '00000000-0000-0000-0000-000000000001', tenant_id: 't', metadata: legacyMeta() };
    const b = { id: '00000000-0000-0000-0000-000000000002', tenant_id: 't', metadata: legacyMeta() };
    const { db, runner } = setup([a, b]);
    await migration.up(runner as never);
    (b.metadata as Record<string, unknown>)['editedAfter'] = 1;
    await migration.down(runner as never);
    expect(a.metadata).toEqual(legacyMeta());
    expect((b.metadata as Record<string, unknown>)['editedAfter']).toBe(1);
    expect(db.statements.some((s) => /DROP TABLE/i.test(s.sql))).toBe(false);
    await migration.up(runner as never); // replay keeps the first BEFORE
    expect(db.log).toHaveLength(2);
  });

  it('the side table is locked down (RLS forced, no policy, revoked)', async () => {
    const { db, runner } = setup([]);
    await migration.up(runner as never);
    const sql = db.statements.map((s) => s.sql).join('\n');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON TABLE "release_metadata_backfill_20260930" FROM PUBLIC');
    expect(sql).not.toContain('CREATE POLICY');
  });
});
