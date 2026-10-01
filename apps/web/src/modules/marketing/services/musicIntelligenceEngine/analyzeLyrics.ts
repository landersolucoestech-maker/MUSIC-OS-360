import type { LyricsSentiment, LyricsTone } from "./lyricsVocabulary";
import type { TrackLyricsAnalysis } from "./types";

export function analyzeLyricsDraft(lyric: string): TrackLyricsAnalysis {
  const text = lyric.trim();
  if (!text) {
    return {
      status: "pending",
      provider: "music-intelligence-local-lyrics",
      secondaryThemes: [],
      hooks: [],
      viralPhrases: [],
      keywords: [],
      editorialTags: [],
      missingData: ["letra"],
    };
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hooks = lines.filter((line) => line.length > 18 && line.length < 90).slice(0, 4);
  const keywords = Array.from(new Set(text.toLowerCase().split(/\W+/).filter((word) => word.length > 4))).slice(0, 10);

  return {
    status: "completed",
    provider: "music-intelligence-local-lyrics",
    mainTheme: inferTheme(text),
    secondaryThemes: keywords.slice(0, 4),
    sentiment: inferSentiment(text),
    narrativeType: "narrativa editorial a validar pela IA",
    tone: inferTone(text),
    hooks,
    viralPhrases: hooks.slice(0, 3),
    keywords,
    targetAudience: "audiência provável baseada em letra, gênero e histórico do artista",
    editorialTags: keywords.slice(0, 6),
    missingData: [],
  };
}

function inferTheme(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("amor") || lower.includes("saudade")) return "amor/relacionamento";
  if (lower.includes("festa") || lower.includes("noite")) return "festa/celebracao";
  if (lower.includes("vencer") || lower.includes("sonho")) return "superacao/ambicao";
  return "tema principal a consolidar";
}

function inferSentiment(text: string): LyricsSentiment {
  const lower = text.toLowerCase();
  if (lower.includes("dor") || lower.includes("choro") || lower.includes("saudade")) return "melancholic";
  if (lower.includes("festa") || lower.includes("feliz") || lower.includes("brilhar")) return "positive";
  return "mixed";
}

function inferTone(text: string): LyricsTone {
  return text.length > 1200 ? "narrative" : "direct";
}
