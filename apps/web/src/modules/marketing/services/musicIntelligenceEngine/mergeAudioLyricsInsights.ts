import { PENDING_VALUE, isPendingValue } from "./pending";
import { lyricsSentimentLabel, normalizeLyricsSentiment } from "./lyricsVocabulary";
import type { TrackAudioAnalysis, TrackDiagnosis, TrackLyricsAnalysis } from "./types";

export function mergeAudioLyricsInsights(audio: TrackAudioAnalysis, lyrics: TrackLyricsAnalysis): TrackDiagnosis {
  const missingData = Array.from(new Set([...audio.missingData, ...lyrics.missingData]));
  const mood = audio.mood && !isPendingValue(audio.mood) ? audio.mood : lyricsSentimentLabel(lyrics.sentiment) || PENDING_VALUE;

  return {
    genre: audio.genrePrediction || PENDING_VALUE,
    subgenre: audio.subgenrePrediction || PENDING_VALUE,
    bpm: audio.bpm || PENDING_VALUE,
    key: audio.key || PENDING_VALUE,
    mood,
    energy: audio.energy || PENDING_VALUE,
    theme: lyrics.mainTheme || PENDING_VALUE,
    sentiment: lyricsSentimentLabel(lyrics.sentiment) || PENDING_VALUE,
    targetAudience: lyrics.targetAudience || PENDING_VALUE,
    editorialTags: lyrics.editorialTags,
    playlistFit: buildPlaylistFit(mood, lyrics.mainTheme),
    platformPriority: buildPlatformPriority(audio.energy, lyrics.hooks.length),
    commercialPotential: audio.energy === "alta" ? "alto para campanhas digitais e vídeos curtos" : "médio, depende de narrativa e segmentação",
    viralPotential: lyrics.hooks.length >= 2 ? "bom potencial de cortes com frases fortes" : "potencial dependente de gancho audiovisual",
    syncPotential: normalizeLyricsSentiment(lyrics.sentiment) === "melancholic" ? "bom para cenas emocionais/reflexivas" : "a validar por briefing de marcas e audiovisual",
    differentiators: [
      lyrics.mainTheme ? `Tema editorial: ${lyrics.mainTheme}` : "",
      audio.mood && !isPendingValue(audio.mood) ? `Mood sonoro: ${audio.mood}` : "",
      lyrics.hooks[0] ? `Frase forte: ${lyrics.hooks[0]}` : "",
    ].filter(Boolean),
    risks: missingData.length ? [`Dados ausentes: ${missingData.join(", ")}`] : ["Validar fit editorial antes de envio massivo."],
    missingData,
  };
}

function buildPlaylistFit(mood?: string, theme?: string) {
  const base = ["Novidades da semana", "Descobertas independentes"];
  if (mood?.toLowerCase().includes("festa")) return [...base, "Festa", "Viral Hits"];
  if (theme?.toLowerCase().includes("amor")) return [...base, "Romanticas", "Pop sentimental"];
  return [...base, "Radar de artistas", "Editorial por gênero"];
}

function buildPlatformPriority(energy?: string, hookCount = 0) {
  if (energy === "alta" || hookCount >= 2) return ["TikTok", "Reels", "Shorts", "Spotify"];
  return ["Spotify", "YouTube Music", "Imprensa", "Curadores independentes"];
}
