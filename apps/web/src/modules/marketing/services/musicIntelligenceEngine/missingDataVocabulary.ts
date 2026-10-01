/**
 * Machine vocabulary of the "missing data" markers of the local music analysis.
 * Tokens are English identifiers; the Portuguese words are display copy only.
 */
export type MissingDataKey = "audio" | "bpm" | "mood" | "genre" | "subgenre" | "lyrics";

export const MISSING_DATA_LABELS: Record<MissingDataKey, string> = {
  audio: "áudio",
  bpm: "BPM",
  mood: "mood",
  genre: "gênero",
  subgenre: "subgênero",
  lyrics: "letra",
};

/** Display copy (PT-BR); an unknown marker is returned unchanged. */
export function missingDataLabel(value: string): string {
  return Object.prototype.hasOwnProperty.call(MISSING_DATA_LABELS, value) ? MISSING_DATA_LABELS[value as MissingDataKey] : value;
}
