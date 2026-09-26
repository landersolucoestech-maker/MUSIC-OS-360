/**
 * platform-profiles/soundcharts-canonical-candidates.util.ts
 *
 * Builds the list of candidates, in priority order, to resolve an artist's
 * canonical Soundcharts UUID — spotify → youtube → deezer →
 * soundcloud, the most reliable identifiers in the Soundcharts database.
 * Used by ALL metric providers so that six independent resolutions are never
 * made: the first candidate that resolves yields the UUID reused
 * by the artist's other metrics (Soundcharts 06).
 *
 * Pure/local extraction (no API call) — for YouTube it only recognizes a
 * UC… channel id already explicit in the URL; it does not resolve an @handle here (that requires
 * the YouTube Data API, kept only inside YouTubeArtistProfileProvider
 * for YouTube's own case).
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

/** The 4 canonical URLs are always dedicated ArtistEntity columns — unlike
 * instagram_url/tiktok_url, which live in metadata (see cachedProfileUrlFor in
 * artist-external-profile-sync.service.ts) and never take part in canonical resolution. */
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
 * Resolves the canonical UUID by trying spotify/youtube/deezer/soundcloud
 * first; falls back to the platform's OWN identifier (ownPlatform)
 * only if none of the four canonical ones resolves — relevant for Instagram/TikTok,
 * which have no canonical identifier of their own in that list.
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
 * Checks the Soundcharts identifier registry of a canonical UUID against
 * this platform's REGISTERED handle — used as SECONDARY evidence by
 * Instagram/TikTok/Apple Music (they are not canonical anchors) when the
 * PRIMARY resolution by the own handle did not index standalone (see providers: the
 * attempt by the registered handle is always first; this function only comes in
 * as a fallback — Phase 1.3, fixes the conceptual inversion of Phase 1.2, where
 * this was consulted before even trying the own handle).
 *
 * Three states instead of a boolean (Phase 1.3): absence of evidence
 * (registry unavailable or no entry for the platform) is NOT the same
 * as confirmation — it is labelled distinctly so it is never
 * mistaken for a proven exact resolution.
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
  /** UUID resolved independently by the other anchors; null when there
   * was not enough data to compare. */
  independentUuid: string | null;
  /**
   * When DIVERGENT, the identifier that Soundcharts REGISTERS for this
   * platform on the independent canonical artist (via getArtistIdentifiers),
   * if any (real finding: the registered SoundCloud "deejaystay" resolves to
   * a Soundcharts entity different from the one Spotify/YouTube/Deezer
   * resolve to — confirmed by Phase 1.3 forensics as cataloguing
   * fragmentation within Soundcharts itself, NOT a registration error: the registry
   * of the "deejaystay" entity ITSELF confirms "deejaystay" as its
   * SoundCloud, and that entity's real metric matched the expected value).
   * Purely diagnostic — never applied automatically, never blocks.
   */
  registryIdentifier: string | null;
}

/**
 * Compares the UUID resolved by an anchor platform's OWN handle
 * (spotify/youtube/deezer/soundcloud) — already resolved by an EXACT lookup of the
 * registered identifier, and therefore already the primary identity proof —
 * against the UUID resolved independently by the OTHER 3 anchors.
 *
 * Phase 1.3: this comparison is PURELY DIAGNOSTIC. A divergence here
 * only means that Soundcharts models this artist as more than one
 * internal entity (cataloguing fragmentation, common when an account was
 * imported from a different source and never went through a manual merge) — NEVER that
 * the link registered by the artist is wrong. The exact resolution by the
 * registered identifier is already, by construction of the Soundcharts by-platform
 * endpoint, the proof that the account belongs to that entity. This
 * result must NEVER gate metric persistence (see providers).
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
