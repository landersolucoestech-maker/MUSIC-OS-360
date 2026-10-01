/**
 * Canonical keys of the `releases.metadata` jsonb written by the release form
 * (ReleaseFormModal) and read by the release report contract / track child sheet.
 *
 * The persisted KEYS were Portuguese. Canonical English keys (user-authored
 * VALUES -- lyrics, names, free text -- are never touched, only the keys):
 *
 *   metadata:   variosArtistas -> variousArtists, generoSecundario -> secondaryGenre,
 *               copyrightDataLancamento -> copyrightReleaseYear,
 *               copyrightDataGravacao -> copyrightRecordingYear,
 *               artistasAdicionaisAlbum -> additionalAlbumArtists, faixas -> tracks
 *   tracks[]:   artista -> artist, isVersionAlternativa -> isAlternateVersion,
 *               tipoVersao -> versionType, artistasAdicionais -> additionalArtists,
 *               produtores -> producers, compositores -> composers,
 *               musicos -> musicians, idioma -> language, letra -> lyrics
 *   credit entries ({nome, role}) and musicians ({nome, instrumento}):
 *               nome -> name, instrumento -> instrument
 *
 * Expand/contract (migration 20260930000019): writers are canonical; readers accept
 * both. When BOTH spellings of a key are present the canonical one wins (the legacy
 * one is dropped). Removal condition: the census queries in
 * findings/persisted-jsonb-pj1.md return 0 for one release window.
 *
 * The web twin of this file is apps/web/src/modules/releases/lib/release-metadata.ts
 * (same tables; keep both in sync).
 */
type Json = Record<string, unknown>;

export const RELEASE_METADATA_KEY_RENAMES: Readonly<Record<string, string>> = {
  variosArtistas: 'variousArtists',
  generoSecundario: 'secondaryGenre',
  copyrightDataLancamento: 'copyrightReleaseYear',
  copyrightDataGravacao: 'copyrightRecordingYear',
  artistasAdicionaisAlbum: 'additionalAlbumArtists',
  faixas: 'tracks',
};

export const RELEASE_TRACK_KEY_RENAMES: Readonly<Record<string, string>> = {
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

export const RELEASE_CREDIT_ENTRY_KEY_RENAMES: Readonly<Record<string, string>> = {
  nome: 'name',
  instrumento: 'instrument',
};

const isPlainObject = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const has = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

export interface RenameResult<T> {
  value: T;
  /** number of legacy keys renamed (or dropped because the canonical key was already present) */
  renamed: number;
  /** number of keys where both spellings were present (canonical kept, legacy dropped) */
  conflicts: number;
}

/** Renames the legacy keys of one plain object; the canonical key wins when both exist. Other keys are preserved untouched. */
export function renameKeys(obj: Json, renames: Readonly<Record<string, string>>): RenameResult<Json> {
  let renamed = 0;
  let conflicts = 0;
  const out: Json = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__') continue; // JSON.parse can create it as an own key; never copy it onto a plain object
    if (!has(renames, key)) {
      if (!has(out, key)) out[key] = value; // own-property check: `key in out` is true for constructor/toString/valueOf (SEC2 L1)
      continue;
    }
    renamed += 1;
    const canonical = renames[key];
    if (has(obj, canonical)) {
      conflicts += 1;
      continue; // canonical wins
    }
    out[canonical] = value;
  }
  return { value: out, renamed, conflicts };
}

function renameEntries(list: unknown, renames: Readonly<Record<string, string>>, acc: { renamed: number; conflicts: number }): unknown {
  if (!Array.isArray(list)) return list;
  return list.map((entry) => {
    if (!isPlainObject(entry)) return entry;
    const r = renameKeys(entry, renames);
    acc.renamed += r.renamed;
    acc.conflicts += r.conflicts;
    return r.value;
  });
}

const TRACK_ENTRY_LISTS = ['additionalArtists', 'producers', 'musicians'] as const;

/** Canonical track object (legacy keys renamed, credit entries renamed). */
export function canonicalReleaseTrack(track: unknown): RenameResult<unknown> {
  if (!isPlainObject(track)) return { value: track, renamed: 0, conflicts: 0 };
  const r = renameKeys(track, RELEASE_TRACK_KEY_RENAMES);
  const acc = { renamed: r.renamed, conflicts: r.conflicts };
  const value = r.value;
  for (const key of TRACK_ENTRY_LISTS) {
    if (has(value, key)) value[key] = renameEntries(value[key], RELEASE_CREDIT_ENTRY_KEY_RENAMES, acc);
  }
  return { value, ...acc };
}

/** Canonical `releases.metadata` (legacy keys renamed at the top level, in tracks[] and in credit entries). Pure; the input is not mutated. */
export function canonicalizeReleaseMetadata(metadata: unknown): RenameResult<unknown> {
  if (!isPlainObject(metadata)) return { value: metadata, renamed: 0, conflicts: 0 };
  const r = renameKeys(metadata, RELEASE_METADATA_KEY_RENAMES);
  const acc = { renamed: r.renamed, conflicts: r.conflicts };
  const value = r.value;
  if (Array.isArray(value['tracks'])) {
    value['tracks'] = value['tracks'].map((track) => {
      const t = canonicalReleaseTrack(track);
      acc.renamed += t.renamed;
      acc.conflicts += t.conflicts;
      return t.value;
    });
  }
  if (has(value, 'additionalAlbumArtists')) {
    value['additionalAlbumArtists'] = renameEntries(value['additionalAlbumArtists'], RELEASE_CREDIT_ENTRY_KEY_RENAMES, acc);
  }
  return { value, ...acc };
}

/** Convenience: canonical metadata object, or the input unchanged when it is not an object. */
export function canonicalReleaseMetadata<T>(metadata: T): T {
  return canonicalizeReleaseMetadata(metadata).value as T;
}
