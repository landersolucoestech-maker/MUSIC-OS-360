import type { IntelligenceEntity, IntelligenceSources, ReleaseContext } from "./types";
import { analyzeAudioDraft } from "./analyzeAudio";
import { analyzeLyricsDraft } from "./analyzeLyrics";
import { mergeAudioLyricsInsights } from "./mergeAudioLyricsInsights";
import { pickReleaseString } from "./utils";

export function loadReleaseContext(
  artist: IntelligenceEntity,
  release: IntelligenceEntity,
  sources: IntelligenceSources,
): ReleaseContext | null {
  const releaseRecord = sources.releases.find((item) => item.id === release.id);
  if (!releaseRecord) return null;

  const contextBase = {
    artist,
    release,
    releaseRecord,
    audioUrl: pickReleaseString(releaseRecord, ["audio_master_url", "audio_url", "wav_url", "master_url", "fonograma_url"]),
    lyric: pickReleaseString(releaseRecord, ["lyrics", "lyric"]),
    coverUrl: pickReleaseString(releaseRecord, ["cover_url", "artwork_url"]),
    genre: pickReleaseString(releaseRecord, ["music_genre", "genero", "genre"]),
    subgenre: pickReleaseString(releaseRecord, ["subgenero", "subgenre"]),
    mood: pickReleaseString(releaseRecord, ["mood", "clima", "atmosfera"]),
    bpm: pickReleaseString(releaseRecord, ["bpm"]),
    isrc: pickReleaseString(releaseRecord, ["isrc_global", "isrc"]),
    upc: pickReleaseString(releaseRecord, ["upc", "codigo_upc", "ean"]),
    releaseDate: pickReleaseString(releaseRecord, ["release_date"]),
    credits: pickReleaseString(releaseRecord, ["credits", "compositores", "produtores"]),
    references: pickReleaseString(releaseRecord, ["referencias", "references", "press_release"]),
    artistHistory: sources.releases
      .filter((item) => item.artist_id === artist.id || item.artistas?.id === artist.id)
      .map((item) => `${item.title}${item.release_date ? ` (${item.release_date})` : ""}`),
    relatedCampaigns: sources.campaigns.filter((item) => item.targetId === release.id || item.targetId === artist.id),
    relatedMetrics: sources.analytics ? [
      `Alcance total: ${sources.analytics.totals.reach}`,
      `Engajamento: ${sources.analytics.totals.engagement}`,
      `Conversoes: ${sources.analytics.totals.conversions}`,
    ] : [],
  };
  const audioAnalysis = analyzeAudioDraft(contextBase);
  const lyricsAnalysis = analyzeLyricsDraft(contextBase.lyric);
  const diagnosis = mergeAudioLyricsInsights(audioAnalysis, lyricsAnalysis);

  return {
    ...contextBase,
    audioAnalysis,
    lyricsAnalysis,
    diagnosis,
  };
}

