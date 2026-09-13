import type { Artist } from "@/modules/artist/hooks/useArtists";
import type { ObraWithRelations, FonogramaWithRelations } from "@/modules/catalog/types/catalog.types";
import type { ArtistProfileContext, IntelligenceEntity, IntelligenceSources } from "./types";
import { estimateReleaseFrequency, inferCareerStage, mostCommon, score, stringifyValue, uniqueStrings } from "./utils";

/**
 * Task J — obras/fonogramas/artistRecord chegam já resolvidos pelo chamador
 * (busca server-side escopada ao artista, via useObras(true, artistId)/
 * useFonogramas(true, artistId)/useEntityById), não mais filtrados de
 * sources.obras/sources.fonogramas/sources.artists sem filtro (capados aos
 * primeiros 50 do tenant).
 */
export function loadArtistContext(
  artist: IntelligenceEntity,
  sources: IntelligenceSources,
  catalog: { artistRecord?: Artist; obras: ObraWithRelations[]; fonogramas: FonogramaWithRelations[] },
): ArtistProfileContext {
  const artistRecord = catalog.artistRecord;
  const obras = catalog.obras;
  const fonogramas = catalog.fonogramas;
  const releases = sources.releases.filter((item) => item.artist_id === artist.id || item.artistas?.id === artist.id);
  const projects = sources.projects.filter((item) => item.artistId === artist.id);
  const campaigns = sources.campaigns.filter((item) => item.targetType === "artista" && item.targetId === artist.id);
  const contents = sources.contents.filter((item) => item.targetType === "artista" && item.targetId === artist.id);
  const tasks = sources.tasks.filter((item) => item.targetType === "artista" && item.targetId === artist.id);
  const pitchings = sources.suggestions.filter((item) => item.targetId === artist.id || item.targetName === artist.label);
  const genreCandidates = [
    artistRecord?.musicGenre,
    ...obras.map((item) => item.genero),
    ...fonogramas.map((item) => item.musicGenre),
    ...releases.map((item) => item.genero),
  ].filter(Boolean).map(String);
  const publicSignals = [
    artistRecord?.instagramUrl ? `Instagram: ${artistRecord.instagramUrl}` : "",
    artistRecord?.instagramFollowers ? `Instagram seguidores: ${artistRecord.instagramFollowers}` : "",
    artistRecord?.tiktokUrl ? `TikTok: ${artistRecord.tiktokUrl}` : "",
    artistRecord?.tiktokFollowers ? `TikTok seguidores: ${artistRecord.tiktokFollowers}` : "",
    artistRecord?.spotifyListeners ? `Spotify ouvintes: ${artistRecord.spotifyListeners}` : "",
    artistRecord?.youtubeSubscribers ? `YouTube inscritos: ${artistRecord.youtubeSubscribers}` : "",
  ].filter(Boolean);
  const releaseDates = releases.map((item) => item.data_lancamento).filter(Boolean).map(String).sort();
  const completedTasks = tasks.filter((item) => item.status === "concluida").length;
  const frequency = estimateReleaseFrequency(releaseDates);

  return {
    artist,
    artistRecord,
    predominantGenre: mostCommon(genreCandidates),
    subgenres: uniqueStrings([
      ...fonogramas.map((item) => stringifyValue(item.classificacao)),
      ...releases.map((item) => stringifyValue(item["subgenero"])),
    ]),
    moods: uniqueStrings([
      ...releases.map((item) => stringifyValue(item["mood"])),
      ...fonogramas.map((item) => stringifyValue(item["mood"])),
    ]),
    references: uniqueStrings([
      ...obras.map((item) => stringifyValue(item.compositor || item.compositores)),
      ...fonogramas.map((item) => stringifyValue(item.produtores || item.gravadora || item.agregadora)),
      ...releases.map((item) => stringifyValue(item.distribuidora || item.gravadora)),
    ]),
    publicSignals,
    careerStage: inferCareerStage(artistRecord?.spotifyListeners, artistRecord?.instagramFollowers, releases.length),
    growthRhythm: inferGrowthRhythm(releaseDates, publicSignals),
    catalog: {
      totalReleases: releases.length,
      totalTracks: fonogramas.length || obras.length,
      releaseDates,
      frequency,
      isrcs: uniqueStrings([...obras.map((item) => item.isrc), ...fonogramas.map((item) => item.isrc), ...releases.map((item) => item.isrc_global)]),
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
      geral: score(releases.length + campaigns.length + publicSignals.length + completedTasks, 24),
      branding: score(publicSignals.length + contents.length, 16),
      catalogo: score(releases.length + fonogramas.length, 20),
      engajamento: score(publicSignals.length + campaigns.length, 12),
      consistencia: releaseDates.length >= 2 ? score(releaseDates.length, 10) : 20,
      crescimento: score((artistRecord?.spotifyListeners ?? 0) / 1000 + releases.length, 120),
    },
    bottleneck: inferBottleneck({ releases: releases.length, campaigns: campaigns.length, publicSignals: publicSignals.length, tasks: tasks.length }),
    actionPlan: {
      d30: ["Atualizar perfil, press kit e narrativa central.", "Selecionar 3 conteudos de maior potencial para Reels/TikTok/Shorts.", "Preparar uma campanha curta de descoberta."],
      d60: ["Organizar proximo ciclo de lancamento ou colaboracao.", "Testar pitch para curadores e imprensa segmentada.", "Revisar canais com baixa consistencia."],
      d90: ["Consolidar territorio artistico e calendario trimestral.", "Criar ativo audiovisual principal.", "Transformar aprendizados em playbook de marketing."],
    },
  };
}

function inferGrowthRhythm(dates: string[], socialSignals: string[]) {
  if (dates.length >= 6 && socialSignals.length >= 3) return "crescimento com base de catalogo e canais ativos";
  if (dates.length >= 3) return "crescimento em validacao por consistencia de lancamentos";
  if (socialSignals.length >= 2) return "crescimento dependente de presenca digital";
  return "ritmo ainda pouco mensuravel";
}

function inferBottleneck(input: { releases: number; campaigns: number; publicSignals: number; tasks: number }) {
  if (input.releases < 2) return "catalogo ainda pequeno para leitura de consistencia";
  if (input.publicSignals < 2) return "poucos sinais de publico e canais ativos";
  if (input.campaigns < 1) return "marketing ainda sem campanhas estruturadas";
  if (input.tasks < 3) return "execução operacional pouco documentada";
  return "priorização estratégica e repetição do que performa melhor";
}

