/**
 * Vocabulary of the project track form fields persisted in `project_tracks` (AP3 / R3-06).
 *
 *  - `instrumental` (varchar(10)) was 'sim' / 'nao'. The column is a free varchar form field (not the boolean
 *    `works.is_instrumental`), so it keeps its type and gets the English enum 'yes' / 'no' (the same pair the release
 *    form persists for `explicit`). PT-BR 'Sim' / 'Não' is the spreadsheet/UI label.
 *  - `language` (varchar(50)) was the PT label slug of the web catalog ('portugues', 'ingles', 'chines-mandarim'...).
 *    Canonical = the ISO 639 code already used by `works.language` ('pt', 'en', 'zh', 'zxx' = instrumental, 'und' = other),
 *    so a project track and the work registered from it share one vocabulary.
 *
 * Writers are canonical; every reader and the API input (DTO @Transform before validation, import cells) still ACCEPT the
 * legacy values. A language text that is not in the catalog (free text from an import) is user content: unchanged.
 * Exact map copies live in migration 20260930000032 (the spec asserts they are equal).
 */
import { Transform } from 'class-transformer';
import { LANGUAGE_LABEL_TO_CODE } from '../works/work-legacy-fields';

export const PROJECT_TRACK_INSTRUMENTAL_VALUES = ['yes', 'no'] as const;

export const LEGACY_PROJECT_TRACK_INSTRUMENTAL: Readonly<Record<string, string>> = { sim: 'yes', nao: 'no', 'não': 'no' };

export const PROJECT_TRACK_INSTRUMENTAL_LABELS_PT_BR: Readonly<Record<string, string>> = { yes: 'Sim', no: 'Não' };

/** Slug of a PT-BR language label exactly as the web catalog derived it (constants/musicalGenres toGenreSlug). */
export function legacyLanguageSlug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** legacy web slug -> ISO 639 code. */
export const LEGACY_PROJECT_TRACK_LANGUAGE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LANGUAGE_LABEL_TO_CODE).map(([label, code]) => [legacyLanguageSlug(label), code]),
);

/** ISO 639 code -> PT-BR label (export / import round trip). */
export const PROJECT_TRACK_LANGUAGE_LABELS_PT_BR: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LANGUAGE_LABEL_TO_CODE).map(([label, code]) => [code, label]),
);

const own = (map: object, key: string): boolean => Object.prototype.hasOwnProperty.call(map, key);

/** 'sim' / 'nao' -> 'yes' / 'no'; canonical and any other value unchanged. */
export function canonicalProjectTrackInstrumental(value: unknown): unknown {
  return typeof value === 'string' && own(LEGACY_PROJECT_TRACK_INSTRUMENTAL, value) ? LEGACY_PROJECT_TRACK_INSTRUMENTAL[value] : value;
}

/** legacy slug -> ISO code; a code and free text unchanged. */
export function canonicalProjectTrackLanguage(value: unknown): unknown {
  return typeof value === 'string' && own(LEGACY_PROJECT_TRACK_LANGUAGE, value) ? LEGACY_PROJECT_TRACK_LANGUAGE[value] : value;
}

/** A spreadsheet cell: exact, then PT-BR label (trimmed, case-insensitive), then legacy value; unknown text unchanged. */
export function projectTrackInstrumentalFromCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const wanted = value.trim().toLowerCase();
  if (wanted === 'yes' || wanted === 'sim' || wanted === 'true') return 'yes';
  if (wanted === 'no' || wanted === 'nao' || wanted === 'não' || wanted === 'false') return 'no';
  return value;
}

export function projectTrackLanguageFromCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (own(PROJECT_TRACK_LANGUAGE_LABELS_PT_BR, trimmed)) return trimmed;
  if (own(LEGACY_PROJECT_TRACK_LANGUAGE, trimmed)) return LEGACY_PROJECT_TRACK_LANGUAGE[trimmed];
  const byLabel = Object.entries(LANGUAGE_LABEL_TO_CODE).find(([label]) => label.toLowerCase() === trimmed.toLowerCase());
  return byLabel ? byLabel[1] : value;
}

/** PT-BR cell text of a persisted value (export); a value outside the maps exports as stored. */
export function projectTrackInstrumentalLabel(value: unknown): unknown {
  const canonical = canonicalProjectTrackInstrumental(value);
  return typeof canonical === 'string' && own(PROJECT_TRACK_INSTRUMENTAL_LABELS_PT_BR, canonical) ? PROJECT_TRACK_INSTRUMENTAL_LABELS_PT_BR[canonical] : value;
}

export function projectTrackLanguageLabel(value: unknown): unknown {
  const canonical = canonicalProjectTrackLanguage(value);
  return typeof canonical === 'string' && own(PROJECT_TRACK_LANGUAGE_LABELS_PT_BR, canonical) ? PROJECT_TRACK_LANGUAGE_LABELS_PT_BR[canonical] : value;
}

/** Maps legacy `instrumental` / `language` of every track item of a request (pure; same array when nothing changes). */
export function canonicalProjectTracks(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  let changed = false;
  const out = value.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    const track = item as Record<string, unknown>;
    const instrumental = canonicalProjectTrackInstrumental(track['instrumental']);
    const language = canonicalProjectTrackLanguage(track['language']);
    if (instrumental === track['instrumental'] && language === track['language']) return item;
    changed = true;
    return { ...track, ...(instrumental !== track['instrumental'] ? { instrumental } : {}), ...(language !== track['language'] ? { language } : {}) };
  });
  return changed ? out : value;
}

/** Import: each track row of a spreadsheet gets its `instrumental` / `trackLanguage` cells canonicalized (labels, legacy values, codes). */
export function canonicalProjectTrackImportRows(rows: unknown): unknown {
  if (!Array.isArray(rows)) return rows;
  return rows.map((raw) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const item = raw as Record<string, unknown>;
    return {
      ...item,
      ...(item['instrumental'] !== undefined ? { instrumental: projectTrackInstrumentalFromCell(item['instrumental']) } : {}),
      ...(item['trackLanguage'] !== undefined ? { trackLanguage: projectTrackLanguageFromCell(item['trackLanguage']) } : {}),
    };
  });
}

/** class-transformer @Transform of `tracks` / `musicas` (BEFORE validation). */
export const canonicalProjectTracksTransform = Transform(({ value }) => canonicalProjectTracks(value));
