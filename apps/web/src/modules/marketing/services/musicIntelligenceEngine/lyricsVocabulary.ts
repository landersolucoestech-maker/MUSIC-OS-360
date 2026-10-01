/**
 * Machine vocabulary of the local lyrics analysis. Values are English
 * identifiers; the Portuguese words are display copy only.
 */
export type LyricsSentiment = "melancholic" | "positive" | "mixed";
export type LyricsTone = "narrative" | "direct";

export const LYRICS_SENTIMENT_LABELS: Record<LyricsSentiment, string> = {
  melancholic: "melancólico",
  positive: "positivo",
  mixed: "misto",
};

export const LYRICS_TONE_LABELS: Record<LyricsTone, string> = {
  narrative: "narrativo",
  direct: "direto",
};

// Compat: values stored by builds that emitted the Portuguese tokens.
const LEGACY_SENTIMENT: Record<string, LyricsSentiment> = {
  melancolico: "melancholic",
  melancólico: "melancholic",
  positivo: "positive",
  misto: "mixed",
};

const LEGACY_TONE: Record<string, LyricsTone> = {
  narrativo: "narrative",
  direto: "direct",
};

function stripAndLower(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeLyricsSentiment(value: string | null | undefined): LyricsSentiment | undefined {
  if (!value) return undefined;
  const key = stripAndLower(value);
  if (key in LYRICS_SENTIMENT_LABELS) return key as LyricsSentiment;
  return LEGACY_SENTIMENT[key];
}

export function normalizeLyricsTone(value: string | null | undefined): LyricsTone | undefined {
  if (!value) return undefined;
  const key = stripAndLower(value);
  if (key in LYRICS_TONE_LABELS) return key as LyricsTone;
  return LEGACY_TONE[key];
}

/** Display copy (PT-BR); unknown free text is returned unchanged. */
export function lyricsSentimentLabel(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const sentiment = normalizeLyricsSentiment(value);
  return sentiment ? LYRICS_SENTIMENT_LABELS[sentiment] : value;
}

export function lyricsToneLabel(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const tone = normalizeLyricsTone(value);
  return tone ? LYRICS_TONE_LABELS[tone] : value;
}
