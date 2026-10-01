import type { Artist } from "@/modules/artist/hooks/useArtists";
import type { WorkWithRelations, PhonogramWithRelations } from "@/modules/catalog/types/catalog.types";
import { phonogramAggregatorLabel, phonogramRecordingClassificationLabel } from "@/modules/catalog/constants/phonogram-options";
import type { ArtistProfileContext, IntelligenceEntity, IntelligenceSources } from "./types";
import { estimateReleaseFrequency, inferCareerStage, mostCommon, score, stringifyValue, uniqueStrings } from "./utils";

/**
 * Task J — works/phonograms/artistRecord arrive already resolved by the caller
 * (a server-side search scoped to the artist, via useWorks(true, artistId)/
 * usePhonograms(true, artistId)/useEntityById), no longer filtered from an unfiltered
 * sources.works/sources.phonograms/sources.artists (capped at the tenant's
 * first 50).
 */
export function loadArtistContext(
  artist: IntelligenceEntity,
  sources: IntelligenceSources,
  catalog: { artistRecord?: Artist; works: WorkWithRelations[]; phonograms: PhonogramWithRelations[] },
): ArtistProfileContext {
  const artistRecord = catalog.artistRecord;
  const works = catalog.works;
  const phonograms = catalog.phonograms;
  const releases = sources.releases.filter((item) => item.artist_id === artist.id || item.artist?.id === artist.id);
  const projects = sources.projects.filter((item) => item.artistId === artist.id);
  const campaigns = sources.campaigns.filter((item) => item.targetType === "artist" && item.targetId === artist.id);
  const contents = sources.contents.filter((item) => item.targetType === "artist" && item.targetId === artist.id);
  const tasks = sources.tasks.filter((item) => item.targetType === "artist" && item.targetId === artist.id);
  const pitchings = sources.suggestions.filter((item) => item.targetId === artist.id || item.targetName === artist.label);
  const genreCandidates = [
    artistRecord?.musicGenre,
    ...works.map((item) => item.music_genre),
    ...phonograms.map((item) => item.music_genre),
    ...releases.map((item) => item.music_genre),
  ].filter(Boolean).map(String);
  const publicSignals = [
    artistRecord?.instagramUrl ? `Instagram: ${artistRecord.instagramUrl}` : "",
    artistRecord?.instagramFollowers ? `Instagram seguidores: ${artistRecord.instagramFollowers}` : "",
    artistRecord?.tiktokUrl ? `TikTok: ${artistRecord.tiktokUrl}` : "",
    artistRecord?.tiktokFollowers ? `TikTok seguidores: ${artistRecord.tiktokFollowers}` : "",
    artistRecord?.spotifyListeners ? `Spotify ouvintes: ${artistRecord.spotifyListeners}` : "",
    artistRecord?.youtubeSubscribers ? `YouTube inscritos: ${artistRecord.youtubeSubscribers}` : "",
  ].filter(Boolean);
  const releaseDates = releases.map((item) => item.release_date).filter(Boolean).map(String).sort();
  const completedTasks = tasks.filter((item) => item.status === "done").length;
  const frequency = estimateReleaseFrequency(releaseDates);

  return {
    artist,
    artistRecord,
    predominantGenre: mostCommon(genreCandidates),
    subgenres: uniqueStrings([
      ...phonograms.map((item) => phonogramRecordingClassificationLabel(item.recording_classification) ?? ""),
      ...releases.map((item) => stringifyValue(item["subgenero"])),
    ]),
    moods: uniqueStrings([
      ...releases.map((item) => stringifyValue(item["mood"])),
      ...phonograms.map((item) => stringifyValue(item["mood"])),
    ]),
    references: uniqueStrings([
      ...works.map((item) => stringifyValue(item.composer_name || item.composer_names)),
      ...phonograms.map((item) => item.record_label_name || phonogramAggregatorLabel(item.aggregator) || ""),
      ...releases.map((item) => stringifyValue(item.distributor || item.record_label)),
    ]),
    publicSignals,
    careerStage: inferCareerStage(artistRecord?.spotifyListeners, artistRecord?.instagramFollowers, releases.length),
    growthRhythm: inferGrowthRhythm(releaseDates, publicSignals),
    catalog: {
      totalReleases: releases.length,
      totalTracks: phonograms.length || works.length,
      releaseDates,
      frequency,
      isrcs: uniqueStrings([...works.map((item) => item.isrc), ...phonograms.map((item) => item.isrc), ...releases.map((item) => item.isrc_global)]),
    },
    operations: {
      projects,
      campaigns,
      contents,
      tasks,
      pitchings,
      completedTasks,
      openTasks: tasks.length - completedTasks,
    },
    scores: {
      overall: score(releases.length + campaigns.length + publicSignals.length + completedTasks, 24),
      branding: score(publicSignals.length + contents.length, 16),
      catalog: score(releases.length + phonograms.length, 20),
      engagement: score(publicSignals.length + campaigns.length, 12),
      consistency: releaseDates.length >= 2 ? score(releaseDates.length, 10) : 20,
      growth: score((artistRecord?.spotifyListeners ?? 0) / 1000 + releases.length, 120),
    },
    bottleneck: inferBottleneck({ releases: releases.length, campaigns: campaigns.length, publicSignals: publicSignals.length, tasks: tasks.length }),
    actionPlan: {
      d30: ["Atualizar perfil, press kit e narrativa central.", "Selecionar 3 conteúdos de maior potencial para Reels/TikTok/Shorts.", "Preparar uma campanha curta de descoberta."],
      d60: ["Organizar próximo ciclo de lançamento ou colaboração.", "Testar pitch para curadores e imprensa segmentada.", "Revisar canais com baixa consistência."],
      d90: ["Consolidar território artístico e calendário trimestral.", "Criar ativo audiovisual principal.", "Transformar aprendizados em playbook de marketing."],
    },
  };
}

function inferGrowthRhythm(dates: string[], socialSignals: string[]) {
  if (dates.length >= 6 && socialSignals.length >= 3) return "crescimento com base de catálogo e canais ativos";
  if (dates.length >= 3) return "crescimento em validação por consistência de lançamentos";
  if (socialSignals.length >= 2) return "crescimento dependente de presença digital";
  return "ritmo ainda pouco mensuravel";
}

function inferBottleneck(input: { releases: number; campaigns: number; publicSignals: number; tasks: number }) {
  if (input.releases < 2) return "catálogo ainda pequeno para leitura de consistência";
  if (input.publicSignals < 2) return "poucos sinais de público e canais ativos";
  if (input.campaigns < 1) return "marketing ainda sem campanhas estruturadas";
  if (input.tasks < 3) return "execução operacional pouco documentada";
  return "priorização estratégica e repetição do que performa melhor";
}

