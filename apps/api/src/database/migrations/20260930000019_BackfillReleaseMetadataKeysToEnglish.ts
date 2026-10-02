import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, isEmptyJsonValue, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000019_BackfillReleaseMetadataKeysToEnglish (PJ1)
 *
 * `releases.metadata` (jsonb) was written by the release form with Portuguese KEYS.
 * Canonical English keys (VALUES -- names, lyrics, free text -- are never touched):
 *
 *   top level  variosArtistas -> variousArtists
 *              generoSecundario -> secondaryGenre
 *              copyrightDataLancamento -> copyrightReleaseYear
 *              copyrightDataGravacao -> copyrightRecordingYear
 *              artistasAdicionaisAlbum -> additionalAlbumArtists
 *              faixas -> tracks
 *   tracks[]   artista -> artist, isVersionAlternativa -> isAlternateVersion,
 *              tipoVersao -> versionType, artistasAdicionais -> additionalArtists,
 *              produtores -> producers, compositores -> composers, musicos -> musicians,
 *              idioma -> language, letra -> lyrics
 *   entries    {nome, role} -> {name, role}; musicians {nome, instrumento} -> {name, instrument}
 *              (inside additionalAlbumArtists / additionalArtists / producers / musicians)
 *
 * Expand/contract, backfill step. The application code that ships with this migration
 * writes the canonical keys (API canonicalizes every write, web writes canonical) and
 * keeps READING both spellings (common/compat/release-metadata.ts, web twin). The
 * contract step (drop the legacy readers) is gated on the census in
 * docs/runbooks/staging-to-production.md#residue-census-20260930000019 returning 0.
 *
 * Rules (see jsonb-row-backfill.ts for the machinery): only rows holding at least one
 * legacy top-level key are candidates; EXACT key match, case-sensitive; every other key
 * is preserved as-is; a row that is already canonical is skipped (idempotent); when BOTH
 * spellings of a key are present the CANONICAL value wins, the legacy one is dropped and
 * the conflict is counted in the log -- unless the canonical value is empty (null, '', [] or {})
 * while the legacy one carries data: then the legacy value is kept under the canonical key (L2,
 * counted separately in the log) (the legacy value stays recoverable from the side
 * table `release_metadata_backfill_20260930`); `updated_at` is left alone; the UPDATE is
 * guarded by the value that was read (concurrent edit wins, retried by a re-run); logs
 * are counts only.
 *
 * down(): puts the recorded BEFORE metadata back for the rows that still hold exactly
 * the AFTER metadata this migration wrote (a row edited since is never reverted).
 * The side table is kept (forensic), drop it in a later migration.
 */
const MIGRATION = 'BackfillReleaseMetadataKeysToEnglish20260930000019';
const LOG_TABLE = 'release_metadata_backfill_20260930';

const TOP: Readonly<Record<string, string>> = {
  variosArtistas: 'variousArtists',
  generoSecundario: 'secondaryGenre',
  copyrightDataLancamento: 'copyrightReleaseYear',
  copyrightDataGravacao: 'copyrightRecordingYear',
  artistasAdicionaisAlbum: 'additionalAlbumArtists',
  faixas: 'tracks',
};
const TRACK: Readonly<Record<string, string>> = {
  artista: 'artist',
  isVersionAlternativa: 'isAlternateVersion',
  tipoVersao: 'versionType',
  artistasAdicionais: 'additionalArtists',
  produtores: 'producers',
  compositores: 'composers',
  musicos: 'musicians',
  idioma: 'language',
  letra: 'lyrics',
};
const ENTRY: Readonly<Record<string, string>> = { nome: 'name', instrumento: 'instrument' };
const TRACK_LISTS = ['additionalArtists', 'producers', 'musicians'] as const;

type Json = Record<string, unknown>;
interface Acc { changed: boolean; conflicts: number; emptyReplaced: number }
const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

function rename(obj: Json, map: Readonly<Record<string, string>>, acc: Acc): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__') continue;
    if (!has(map, key)) {
      // own-property check: `key in out` is true for constructor/toString/valueOf... and would drop those keys (L1)
      if (!has(out, key)) out[key] = value;
      continue;
    }
    acc.changed = true;
    if (has(obj, map[key])) {
      acc.conflicts += 1;
      if (isEmptyJsonValue(obj[map[key]]) && !isEmptyJsonValue(value)) {
        acc.emptyReplaced += 1; // canonical is null/[]: the legacy data must not be lost
        out[map[key]] = value;
      }
      continue;
    }
    out[map[key]] = value;
  }
  return out;
}

function renameList(list: unknown, acc: Acc): unknown {
  if (!Array.isArray(list)) return list;
  return list.map((entry) => (isObject(entry) ? rename(entry, ENTRY, acc) : entry));
}

/** Exported for the unit spec only. */
export function canonicalReleaseMetadataForBackfill(metadata: unknown): { value: unknown; changed: boolean; conflicts: number; emptyCanonicalReplaced: number } {
  if (!isObject(metadata)) return { value: metadata, changed: false, conflicts: 0, emptyCanonicalReplaced: 0 };
  const acc: Acc = { changed: false, conflicts: 0, emptyReplaced: 0 };
  const out = rename(metadata, TOP, acc);
  if (Array.isArray(out['tracks'])) {
    out['tracks'] = (out['tracks'] as unknown[]).map((track) => {
      if (!isObject(track)) return track;
      const t = rename(track, TRACK, acc);
      for (const key of TRACK_LISTS) if (has(t, key)) t[key] = renameList(t[key], acc);
      return t;
    });
  }
  if (has(out, 'additionalAlbumArtists')) out['additionalAlbumArtists'] = renameList(out['additionalAlbumArtists'], acc);
  return { value: out, changed: acc.changed, conflicts: acc.conflicts, emptyCanonicalReplaced: acc.emptyReplaced };
}

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'releases',
  logTable: LOG_TABLE,
  columns: ['metadata'],
  jsonbColumns: ['metadata'],
  candidatePredicate: `"metadata" ?| ARRAY[${Object.keys(TOP).map((k) => `'${k}'`).join(', ')}]::text[]`,
  transform(row) {
    const { value, changed, conflicts, emptyCanonicalReplaced } = canonicalReleaseMetadataForBackfill(row['metadata']);
    return changed ? { set: { metadata: value }, conflicts, emptyCanonicalReplaced } : null;
  },
};

export class BackfillReleaseMetadataKeysToEnglish20260930000019 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    await backfillRows(queryRunner, SPEC);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await restoreRows(queryRunner, SPEC);
  }
}
