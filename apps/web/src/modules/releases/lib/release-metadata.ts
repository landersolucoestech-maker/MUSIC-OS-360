/**
 * releases.metadata persisted keys (web twin of
 * apps/api/src/common/compat/release-metadata.ts -- keep both tables in sync).
 *
 * The release form used to persist Portuguese KEYS (variosArtistas, faixas[].tipoVersao, ...).
 * Canonical English keys are written now; legacy keys are still READ (rows not yet backfilled by
 * migration 20260930000019, responses of an older API). When both spellings exist the canonical
 * one wins. Only keys are renamed: user-authored values (names, lyrics, free text) are untouched.
 * Removal condition of the legacy readers: census queries in docs/runbooks/staging-to-production.md#residue-census-20260930000019 at 0.
 */
type Json = Record<string, unknown>;

const TOP: Readonly<Record<string, string>> = {
  variosArtistas: "variousArtists",
  generoSecundario: "secondaryGenre",
  copyrightDataLancamento: "copyrightReleaseYear",
  copyrightDataGravacao: "copyrightRecordingYear",
  artistasAdicionaisAlbum: "additionalAlbumArtists",
  faixas: "tracks",
};
const TRACK: Readonly<Record<string, string>> = {
  artista: "artist",
  isVersionAlternativa: "isAlternateVersion",
  tipoVersao: "versionType",
  artistasAdicionais: "additionalArtists",
  produtores: "producers",
  compositores: "composers",
  musicos: "musicians",
  idioma: "language",
  letra: "lyrics",
};
const ENTRY: Readonly<Record<string, string>> = { nome: "name", instrumento: "instrument" };
const TRACK_LISTS = ["additionalArtists", "producers", "musicians"] as const;

const isObject = (v: unknown): v is Json => v !== null && typeof v === "object" && !Array.isArray(v);
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

function rename(obj: Json, map: Readonly<Record<string, string>>): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "__proto__") continue;
    if (!has(map, key)) {
      if (!(key in out)) out[key] = value;
      continue;
    }
    if (has(obj, map[key])) continue; // canonical wins
    out[map[key]] = value;
  }
  return out;
}

const renameList = (list: unknown): unknown =>
  Array.isArray(list) ? list.map((entry) => (isObject(entry) ? rename(entry, ENTRY) : entry)) : list;

/** Canonical track (legacy keys renamed, credit entries `nome` -> `name`, `instrumento` -> `instrument`). */
export function canonicalReleaseTrack<T = Json>(track: unknown): T {
  if (!isObject(track)) return track as T;
  const out = rename(track, TRACK);
  for (const key of TRACK_LISTS) if (has(out, key)) out[key] = renameList(out[key]);
  return out as T;
}

/** Canonical `releases.metadata`; pure, the input is not mutated, non-objects are returned as-is. */
export function canonicalReleaseMetadata(metadata: unknown): Json {
  if (!isObject(metadata)) return {};
  const out = rename(metadata, TOP);
  if (Array.isArray(out["tracks"])) out["tracks"] = (out["tracks"] as unknown[]).map((t) => canonicalReleaseTrack(t));
  if (has(out, "additionalAlbumArtists")) out["additionalAlbumArtists"] = renameList(out["additionalAlbumArtists"]);
  // Pre-camelCase snake_case spelling read by the view modal before this rename.
  if (!has(out, "secondaryGenre") && typeof metadata["genero_secundario"] === "string") out["secondaryGenre"] = metadata["genero_secundario"];
  return out;
}
