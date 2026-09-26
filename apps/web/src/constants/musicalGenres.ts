/**
 * constants/musicalGenres.ts
 *
 * SINGLE SOURCE OF TRUTH — Musical genres (PT-BR display labels).
 *
 * Every frontend module must import from here. Keeping local/duplicated
 * musical genre lists is forbidden. Catalog sorted alphabetically (pt-BR locale).
 * Presentation layer only — does not change backend/contracts.
 */

/** Ascending alphabetical sort in PT-BR (case/accent-insensitive). */
export function sortLabelsPtBr(items: string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

export function sortOptionsPtBr<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
}

/** Stable slug (canonical value) derived from the label. */
export function toGenreSlug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Canonical labels (PT-BR), already sorted alphabetically. */
export const MUSICAL_GENRE_LABELS: string[] = sortLabelsPtBr([
  "Afrobeat",
  "Alternativo",
  "Amapiano",
  "Arrocha",
  "Axé",
  "Baião",
  "Bachata",
  "Blues",
  "Bolero",
  "Boom Bap",
  "Bossa Nova",
  "Clássica",
  "Country",
  "Cumbia",
  "Dancehall",
  "Deep House",
  "Drill",
  "Drum and Bass",
  "Dubstep",
  "EDM",
  "Eletrônica",
  "Experimental",
  "Folk",
  "Forró",
  "Forró Pé de Serra",
  "Funk",
  "Funk Carioca",
  "Funk Paulista",
  "Gospel",
  "Hard Rock",
  "Heavy Metal",
  "Hip Hop",
  "House",
  "Indie",
  "Indie Rock",
  "Instrumental",
  "J-Pop",
  "Jazz",
  "K-Pop",
  "Latina",
  "Lo-fi",
  "Melodic Techno",
  "Metal",
  "MPB",
  "New Age",
  "Pagode",
  "Piseiro",
  "Pop",
  "Pop Rock",
  "Progressive House",
  "Punk",
  "R&B",
  "Rap",
  "Reggae",
  "Reggaeton",
  "Rock",
  "Salsa",
  "Samba",
  "Samba Rock",
  "Sertanejo",
  "Sertanejo Universitário",
  "Soul",
  "Tech House",
  "Techno",
  "Trance",
  "Trap",
  "Trap Funk",
  "Xote",
  "Outro",
]);

export interface GenreOption {
  value: string;
  label: string;
}

/** Canonical catalog {value(slug), label}, sorted alphabetically. */
export const MUSICAL_GENRES: GenreOption[] = MUSICAL_GENRE_LABELS.map((label) => ({
  value: toGenreSlug(label),
  label,
}));

/** slug → label map (to display the label from a persisted value). */
export const MUSICAL_GENRE_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  MUSICAL_GENRES.map((g) => [g.value, g.label]),
);
