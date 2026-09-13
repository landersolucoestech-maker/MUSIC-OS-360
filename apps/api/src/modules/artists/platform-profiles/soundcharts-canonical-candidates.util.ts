/**
 * platform-profiles/soundcharts-canonical-candidates.util.ts
 *
 * Constrói a lista de candidatos, em ordem de prioridade, para resolver o
 * UUID Soundcharts canônico de um artista — spotify → youtube → deezer →
 * soundcloud, os identificadores mais confiáveis na base da Soundcharts.
 * Usado por TODOS os providers de métrica para nunca fazer seis resoluções
 * independentes: o primeiro candidato que resolver dá o UUID reutilizado
 * pelas demais métricas do mesmo artista (Soundcharts 06).
 *
 * Extração pura/local (sem chamada de API) — para YouTube só reconhece um
 * id de canal UC… já explícito na URL; não resolve @handle aqui (isso exige
 * a YouTube Data API, mantida apenas dentro do YouTubeArtistProfileProvider
 * para o próprio caso do YouTube).
 */
import { parseSpotifyArtistId } from '../../integrations/spotify/spotify-url.util';
import { parseYoutubeRef } from './youtube-ref.util';
import type { SoundchartsService } from '../../integrations/soundcharts/soundcharts.service';
import type { ArtistEntity } from '../../../database/entities';

export interface CanonicalArtistUrls {
  spotifyUrl?: string | null;
  youtubeUrl?: string | null;
  deezerUrl?: string | null;
  soundcloudUrl?: string | null;
}

/** As 4 URLs canônicas são sempre colunas dedicadas de ArtistEntity — ao contrário de
 * instagram_url/tiktok_url, que vivem em metadata (ver cachedProfileUrlFor em
 * artist-external-profile-sync.service.ts) e nunca participam da resolução canônica. */
export function canonicalUrlsFromArtist(artist: ArtistEntity): CanonicalArtistUrls {
  return {
    spotifyUrl: artist.spotify_url,
    youtubeUrl: artist.youtube_url,
    deezerUrl: artist.deezer_url,
    soundcloudUrl: artist.soundcloud_url,
  };
}

function extractYouTubeChannelId(value: string): string | null {
  const ref = parseYoutubeRef(value);
  return ref?.kind === 'id' ? ref.value : null;
}

function extractDeezerArtistId(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/artist\/(\d+)/);
  return match?.[1] ?? null;
}

function extractSoundCloudSlug(value: string): string | null {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i);
  return match?.[1] ?? null;
}

export function buildCanonicalCandidates(
  urls: CanonicalArtistUrls,
): Array<{ platform: string; externalId: string | null }> {
  return [
    { platform: 'spotify', externalId: urls.spotifyUrl ? parseSpotifyArtistId(urls.spotifyUrl) : null },
    { platform: 'youtube', externalId: urls.youtubeUrl ? extractYouTubeChannelId(urls.youtubeUrl) : null },
    { platform: 'deezer', externalId: urls.deezerUrl ? extractDeezerArtistId(urls.deezerUrl) : null },
    { platform: 'soundcloud', externalId: urls.soundcloudUrl ? extractSoundCloudSlug(urls.soundcloudUrl) : null },
  ];
}

/**
 * Resolve o UUID canônico tentando spotify/youtube/deezer/soundcloud
 * primeiro; só cai para o identificador da PRÓPRIA plataforma (ownPlatform)
 * se nenhum dos quatro canônicos resolver — relevante para Instagram/TikTok,
 * que não têm identificador canônico próprio nessa lista.
 */
export async function resolveCanonicalUuidForProvider(
  soundcharts: SoundchartsService,
  canonicalUrls: CanonicalArtistUrls | undefined,
  ownPlatform: string,
  ownExternalId: string | null,
): Promise<string> {
  const candidates = buildCanonicalCandidates(canonicalUrls ?? {});
  if (!candidates.some((c) => c.platform === ownPlatform)) {
    candidates.push({ platform: ownPlatform, externalId: ownExternalId });
  }
  return soundcharts.resolveCanonicalArtistUuid(candidates);
}

export type RegistryMatchStatus = 'CONFIRMED' | 'INSUFFICIENT_EVIDENCE' | 'MISMATCH';

/**
 * Checa o registry de identifiers da Soundcharts de um UUID canônico contra
 * o handle REGISTRADO desta plataforma — usado como evidência SECUNDÁRIA por
 * Instagram/TikTok/Apple Music (não são âncoras canônicas) quando a resolução
 * PRIMÁRIA pelo próprio handle não indexou standalone (ver providers: a
 * tentativa pelo handle cadastrado é sempre a primeira, esta função só entra
 * como fallback — Fase 1.3, corrige inversão conceitual da Fase 1.2, onde
 * isso era consultado antes de sequer tentar o handle próprio).
 *
 * Três estados em vez de booleano (Fase 1.3): ausência de evidência
 * (registry indisponível ou sem entrada para a plataforma) NÃO é a mesma
 * coisa que confirmação — é rotulada distintamente para nunca ser
 * confundida com uma resolução exata comprovada.
 */
export async function checkRegisteredHandleAgainstRegistry(
  soundcharts: SoundchartsService,
  uuid: string,
  ownPlatform: string,
  registeredHandle: string,
): Promise<RegistryMatchStatus> {
  let identifiers: Array<{ platform: string; identifier: string }>;
  try {
    ({ identifiers } = await soundcharts.getArtistIdentifiers(uuid));
  } catch {
    return 'INSUFFICIENT_EVIDENCE';
  }
  const registered = identifiers.find((i) => i.platform === ownPlatform);
  if (!registered) return 'INSUFFICIENT_EVIDENCE';
  return registered.identifier.toLowerCase() === registeredHandle.toLowerCase() ? 'CONFIRMED' : 'MISMATCH';
}

export type CrossPlatformStatus = 'CROSS_PLATFORM_CONSISTENT' | 'CROSS_PLATFORM_DIVERGENT' | 'CROSS_PLATFORM_UNKNOWN';

export interface CrossPlatformEvidence {
  status: CrossPlatformStatus;
  /** UUID resolvido independentemente pelas outras âncoras; null quando não
   * havia dado suficiente para comparar. */
  independentUuid: string | null;
  /**
   * Quando DIVERGENT, o identifier que a Soundcharts REGISTRA para esta
   * plataforma no artista canônico independente (via getArtistIdentifiers),
   * se houver (achado real: SoundCloud "deejaystay" cadastrado resolve para
   * uma entidade Soundcharts diferente da que Spotify/YouTube/Deezer
   * resolvem — confirmado via forense Fase 1.3 como fragmentação de
   * catalogação da própria Soundcharts, NÃO um erro de cadastro: o registry
   * da PRÓPRIA entidade "deejaystay" confirma "deejaystay" como seu
   * SoundCloud, e a métrica real dessa entidade bateu com o valor esperado).
   * Puramente diagnóstico — nunca aplicado automaticamente, nunca bloqueia.
   */
  registryIdentifier: string | null;
}

/**
 * Compara o UUID resolvido pelo PRÓPRIO handle de uma plataforma âncora
 * (spotify/youtube/deezer/soundcloud) — já resolvido por lookup EXATO do
 * identifier cadastrado, portanto já é a prova de identidade primária —
 * contra o UUID resolvido independentemente pelas OUTRAS 3 âncoras.
 *
 * Fase 1.3: essa comparação é PURAMENTE DIAGNÓSTICA. Uma divergência aqui
 * significa apenas que a Soundcharts modela esse artista em mais de uma
 * entidade interna (fragmentação de catalogação, comum quando uma conta foi
 * importada de fonte diferente e nunca passou por merge manual) — NUNCA que
 * o link cadastrado pelo artista esteja errado. A resolução exata pelo
 * identifier cadastrado já é, por construção do endpoint by-platform da
 * Soundcharts, a prova de que aquela conta pertence a essa entidade. Este
 * resultado NUNCA deve gatear persistência de métrica (ver providers).
 */
export async function evaluateCrossPlatformEvidence(
  soundcharts: SoundchartsService,
  canonicalUrls: CanonicalArtistUrls | undefined,
  ownPlatform: string,
  ownResolvedUuid: string,
): Promise<CrossPlatformEvidence> {
  const independentCandidates = buildCanonicalCandidates(canonicalUrls ?? {}).filter(
    (c) => c.platform !== ownPlatform && c.externalId,
  );
  if (independentCandidates.length === 0) {
    return { status: 'CROSS_PLATFORM_UNKNOWN', independentUuid: null, registryIdentifier: null };
  }
  let independentUuid: string;
  try {
    independentUuid = await soundcharts.resolveCanonicalArtistUuid(independentCandidates);
  } catch {
    return { status: 'CROSS_PLATFORM_UNKNOWN', independentUuid: null, registryIdentifier: null };
  }
  if (independentUuid === ownResolvedUuid) {
    return { status: 'CROSS_PLATFORM_CONSISTENT', independentUuid, registryIdentifier: null };
  }
  let registryIdentifier: string | null = null;
  try {
    const { identifiers } = await soundcharts.getArtistIdentifiers(independentUuid);
    registryIdentifier = identifiers.find((i) => i.platform === ownPlatform)?.identifier ?? null;
  } catch {
    registryIdentifier = null;
  }
  return { status: 'CROSS_PLATFORM_DIVERGENT', independentUuid, registryIdentifier };
}
