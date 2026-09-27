import type { TrackAudioAnalysis, TrackDiagnosis, TrackLyricsAnalysis } from "./types";

export function mergeAudioLyricsInsights(audio: TrackAudioAnalysis, lyrics: TrackLyricsAnalysis): TrackDiagnosis {
  const missingData = Array.from(new Set([...audio.missingData, ...lyrics.missingData]));
  const mood = audio.mood && audio.mood !== "pendente" ? audio.mood : lyrics.sentiment || "pendente";

  return {
    genre: audio.genrePrediction || "pendente",
    subgenre: audio.subgenrePrediction || "pendente",
    bpm: audio.bpm || "pendente",
    key: audio.key || "pendente",
    mood,
    energy: audio.energy || "pendente",
    theme: lyrics.mainTheme || "pendente",
    sentiment: lyrics.sentiment || "pendente",
    targetAudience: lyrics.targetAudience || "pendente",
    editorialTags: lyrics.editorialTags,
    playlistFit: buildPlaylistFit(mood, lyrics.mainTheme),
    platformPriority: buildPlatformPriority(audio.energy, lyrics.hooks.length),
    commercialPotential: audio.energy === "alta" ? "alto para campanhas digitais e vídeos curtos" : "médio, depende de narrativa e segmentação",
    viralPotential: lyrics.hooks.length >= 2 ? "bom potencial de cortes com frases fortes" : "potencial dependente de gancho audiovisual",
    syncPotential: lyrics.sentiment === "melancolico" ? "bom para cenas emocionais/reflexivas" : "a validar por briefing de marcas e audiovisual",
    differentiators: [
      lyrics.mainTheme ? `Tema editorial: ${lyrics.mainTheme}` : "",
      audio.mood && audio.mood !== "pendente" ? `Mood sonoro: ${audio.mood}` : "",
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
