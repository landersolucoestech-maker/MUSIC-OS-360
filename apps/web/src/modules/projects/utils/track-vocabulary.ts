/**
 * Vocabulary of the project track form fields (AP3 / R3-06). Mirror of
 * apps/api/src/modules/projects/project-track-vocabulary.ts.
 *
 *  - `instrumental`: 'yes' | 'no' (was 'sim' | 'nao'; the persisted column is a varchar form field).
 *  - `language`: the ISO 639 code of `works.language` ('pt', 'en', 'zxx'...), was the PT label slug ('portugues', 'ingles').
 *
 * Rows persisted before migration 20260930000032 and responses of a not yet migrated API still carry the
 * legacy spelling, so every reader goes through the canonical* functions; nothing ever writes it.
 * A language that is not in the catalog (free text from an import) is user content and is returned unchanged.
 */
import { LANGUAGES } from "@/constants/languages";
import { WORK_LANGUAGE_LABEL_BY_CODE, workLanguageCodeFromProjectLanguage } from "@/modules/catalog/constants/work-options";

export type TrackInstrumental = "yes" | "no";

export const LEGACY_TRACK_INSTRUMENTAL_TO_CANONICAL: Readonly<Record<string, TrackInstrumental>> = {
  sim: "yes",
  nao: "no",
  "não": "no",
};

export const TRACK_INSTRUMENTAL_OPTIONS: ReadonlyArray<{ value: TrackInstrumental; label: string }> = [
  { value: "no", label: "Não" },
  { value: "yes", label: "Sim" },
];

/** 'sim'/'nao' -> 'yes'/'no'; canonical and unknown values are returned unchanged ("" when absent). */
export function canonicalTrackInstrumental(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (Object.prototype.hasOwnProperty.call(LEGACY_TRACK_INSTRUMENTAL_TO_CANONICAL, v)) return LEGACY_TRACK_INSTRUMENTAL_TO_CANONICAL[v];
  return v;
}

/** Legacy web slug -> ISO code; a code and free text are returned unchanged ("" when absent). */
export function canonicalTrackLanguage(value: unknown): string {
  if (typeof value !== "string") return "";
  if (Object.prototype.hasOwnProperty.call(WORK_LANGUAGE_LABEL_BY_CODE, value)) return value;
  return workLanguageCodeFromProjectLanguage(value) ?? value;
}

/** Select options of the project track language: ISO 639 code as value, PT-BR label (same catalog order as before). */
export const TRACK_LANGUAGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = LANGUAGES.map((language) => ({
  value: workLanguageCodeFromProjectLanguage(language.value) ?? language.value,
  label: language.label,
}));

/** PT-BR label of a stored track language (code or legacy slug); free text is shown as typed. */
export function trackLanguageLabel(value: unknown): string {
  const code = canonicalTrackLanguage(value);
  return Object.prototype.hasOwnProperty.call(WORK_LANGUAGE_LABEL_BY_CODE, code) ? WORK_LANGUAGE_LABEL_BY_CODE[code] : code;
}
