/**
 * constants/languages.ts
 *
 * SINGLE SOURCE OF TRUTH — Song languages (PT-BR display labels).
 *
 * Every frontend module must import from here. Keeping local/duplicated
 * language lists is forbidden. Catalog sorted alphabetically (pt-BR locale).
 * Presentation layer only — does not change backend/contracts.
 */

import { sortLabelsPtBr, sortOptionsPtBr, toGenreSlug } from "./musicalGenres";

export { sortLabelsPtBr, sortOptionsPtBr };

/** Stable slug (canonical value) derived from the language label. */
export const toLanguageSlug = toGenreSlug;

/** Canonical language labels (PT-BR), already sorted alphabetically. */
export const LANGUAGE_LABELS: string[] = sortLabelsPtBr([
  "Alemão",
  "Amárico",
  "Árabe",
  "Bengali",
  "Cantonês",
  "Chinês Mandarim",
  "Coreano",
  "Dinamarquês",
  "Espanhol",
  "Filipino",
  "Finlandês",
  "Francês",
  "Grego",
  "Hebraico",
  "Hindi",
  "Holandês",
  "Indonésio",
  "Inglês",
  "Instrumental (Sem Letra)",
  "Iorubá",
  "Italiano",
  "Japonês",
  "Latim",
  "Malaio",
  "Multilíngue",
  "Norueguês",
  "Persa",
  "Polonês",
  "Português",
  "Punjabi",
  "Russo",
  "Suaíli",
  "Sueco",
  "Tailandês",
  "Tamil",
  "Telugu",
  "Turco",
  "Ucraniano",
  "Urdu",
  "Vietnamita",
  "Zulu",
  "Outro",
]);

export interface LanguageOption {
  value: string;
  label: string;
}

/** Canonical catalog {value(slug), label}, sorted alphabetically. */
export const LANGUAGES: LanguageOption[] = LANGUAGE_LABELS.map((label) => ({
  value: toLanguageSlug(label),
  label,
}));

/** slug → label map (to display the label from a persisted value). */
export const LANGUAGE_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.value, l.label]),
);
