import { classifyFailureCode, type ApiErrorCode } from '@music-os-360/types';
import type { ArtistPlatformProfileEntity } from '../../../database/entities';

export const SOCIAL_PLATFORMS = ['spotify', 'youtube', 'deezer', 'soundcloud', 'instagram', 'tiktok', 'apple-music'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialPlatformSyncStatus = 'pending' | 'success' | 'failed' | 'skipped';

/** find-5bf4716b: single source of truth for the "sync succeeded" literal,
 * used to filter/query rows eligible for analytics (career-stage, market
 * benchmark) — was previously duplicated as a bare 'success' string literal
 * independently in a JS .filter() and a raw SQL WHERE clause. */
export const SYNC_STATUS_SUCCESS: SocialPlatformSyncStatus = 'success';

export interface SocialPlatformSyncRequest {
  tenant_id: string;
  artist_id: string;
  platform: SocialPlatform;
  external_url?: string | null;
  external_id?: string | null;
  requested_by: string;
  reason: 'manual';
  idempotency_key: string;
}

export interface SocialPlatformProfileSnapshot {
  tenant_id: string;
  artist_id: string;
  platform: SocialPlatform;
  external_id: string | null;
  external_url: string | null;
  display_name: string | null;
  username: string | null;
  profile_url: string | null;
  image_url: string | null;
  followers: number | null;
  subscribers: number | null;
  monthly_listeners: number | null;
  popularity: number | null;
  total_views: string | null;
  total_videos: number | null;
  total_tracks: number | null;
  total_albums: number | null;
  raw_payload: Record<string, unknown>;
  sync_status: SocialPlatformSyncStatus;
  last_synced_at: Date | null;
  last_error: string | null;
}

export interface ArtistPlatformProviderInput {
  tenantId: string;
  artistId: string;
  externalId?: string | null;
  externalUrl?: string | null;
  /**
   * The artist's canonical URLs (independent of the platform being
   * synced) — used to resolve the Soundcharts UUID ONCE via the
   * spotify→youtube→deezer→soundcloud fallback, reused by all of the
   * artist's metrics (Soundcharts 06).
   */
  canonicalUrls?: {
    spotifyUrl?: string | null;
    youtubeUrl?: string | null;
    deezerUrl?: string | null;
    soundcloudUrl?: string | null;
  };
}

export interface ArtistPlatformProvider {
  platform: SocialPlatform;
  isConfigured(tenantId: string): Promise<boolean>;
  resolve(input: ArtistPlatformProviderInput): Promise<SocialPlatformProfileSnapshot>;
}

export interface ArtistPlatformSyncJobPayload {
  tenant_id: string;
  artist_id: string;
  platform: SocialPlatform;
  external_id?: string | null;
  external_url?: string | null;
  requested_by: string;
  reason: 'manual';
  idempotency_key: string;
}

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export function toSocialPlatformSnapshot(entity: ArtistPlatformProfileEntity): SocialPlatformProfileSnapshot {
  return {
    tenant_id: entity.tenant_id,
    artist_id: entity.artist_id,
    platform: entity.platform as SocialPlatform,
    external_id: entity.external_id,
    external_url: entity.external_url,
    display_name: entity.display_name,
    username: entity.username,
    profile_url: entity.profile_url,
    image_url: entity.image_url,
    followers: entity.followers,
    subscribers: entity.subscribers,
    monthly_listeners: entity.monthly_listeners,
    popularity: entity.popularity,
    total_views: entity.total_views,
    total_videos: entity.total_videos,
    total_tracks: entity.total_tracks,
    total_albums: entity.total_albums,
    raw_payload: entity.raw_payload ?? {},
    sync_status: entity.sync_status as SocialPlatformSyncStatus,
    last_synced_at: entity.last_synced_at,
    last_error: entity.last_error,
  };
}

/**
 * Public wire shape of a platform profile snapshot. The persisted `last_error`
 * text (provider/HTTP/database diagnostics) never crosses the network: clients
 * get the stable `last_error_code` only.
 *
 * `last_error` is kept for one release as a DEPRECATED alias that carries the
 * same stable code (the web type still declares the field); remove it once the
 * web type reads `last_error_code`.
 */
export type PublicSocialPlatformProfile = Omit<SocialPlatformProfileSnapshot, 'last_error'> & {
  last_error_code: ApiErrorCode | null;
  /** @deprecated carries the stable code, never raw text. Use `last_error_code`. */
  last_error: ApiErrorCode | null;
};

export function toPublicSocialPlatformProfile(snapshot: SocialPlatformProfileSnapshot): PublicSocialPlatformProfile {
  const code = snapshot.last_error ? classifyFailureCode(snapshot.last_error, 'SYNC_FAILED') : null;
  return { ...snapshot, last_error_code: code, last_error: code };
}
