/**
 * Machine vocabulary of the local audio analysis. Values are English
 * identifiers; the Portuguese words are display copy only.
 */
export type AudioLevel = "high" | "medium" | "low";

export const AUDIO_LEVEL_LABELS: Record<AudioLevel, string> = {
  high: "alta",
  medium: "média",
  low: "baixa",
};

// Compat: values produced by builds that emitted the Portuguese tokens
// ("baixa/media" was the old low-to-medium energy bucket).
const LEGACY_LEVEL: Record<string, AudioLevel> = {
  alta: "high",
  media: "medium",
  média: "medium",
  baixa: "low",
  "baixa/media": "low",
  "baixa/média": "low",
};

export function normalizeAudioLevel(value: string | null | undefined): AudioLevel | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  if (key in AUDIO_LEVEL_LABELS) return key as AudioLevel;
  return LEGACY_LEVEL[key];
}

/** Display copy (PT-BR); unknown free text (e.g. the pending sentinel) is returned unchanged. */
export function audioLevelLabel(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const level = normalizeAudioLevel(value);
  return level ? AUDIO_LEVEL_LABELS[level] : value;
}
