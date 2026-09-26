import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  ArtistPlatformProvider,
  ArtistPlatformProviderInput,
  SocialPlatformProfileSnapshot,
} from '../social-platform-sync.types';
import { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import { primaryIdentityProvenance, soundchartsNotIndexedProvenance, soundchartsProvenance } from '../soundcharts-provenance.util';
import { evaluateCrossPlatformEvidence } from '../soundcharts-canonical-candidates.util';

/**
 * Single source of the SoundCloud followers card: Soundcharts
 * /audience/soundcloud. It no longer depends on SOUNDCLOUD_CLIENT_ID/SECRET —
 * that credential (own SoundCloud integration) may still exist
 * for other uses, but no longer blocks Platform Metrics
 * (Soundcharts 05).
 */
@Injectable()
export class SoundCloudArtistProfileProvider implements ArtistPlatformProvider {
  readonly platform = 'soundcloud' as const;

  constructor(private readonly soundcharts: SoundchartsService) {}

  async isConfigured(_tenantId?: string): Promise<boolean> {
    return this.soundcharts.isConfigured();
  }

  async resolve(input: ArtistPlatformProviderInput): Promise<SocialPlatformProfileSnapshot> {
    if (!(await this.isConfigured())) {
      throw new ServiceUnavailableException(
        'SoundCloud (Soundcharts) não configurado: defina SOUNDCHARTS_CLIENT_ID e SOUNDCHARTS_CLIENT_SECRET no ambiente da API',
      );
    }

    const slug = input.externalId ?? this.extractSlug(input.externalUrl ?? '');
    if (!slug) throw new Error('SoundCloud profile slug missing or invalid');

    // find-4e35ea8e: a SoundCloud slug that resolves successfully (it really
    // exists) but is not indexed on Soundcharts is a VALID 404 response
    // (same pattern already applied to Instagram/TikTok/Apple Music/YouTube) —
    // never sync_status=failed ("Erro"), always success with null metrics
    // ("Indisponível" in the UI).
    let uuid: string | null = null;
    try {
      uuid = await this.soundcharts.resolveArtistByPlatform('soundcloud', slug);
    } catch (err) {
      if (!(err instanceof SoundchartsNotFoundError)) throw err;
    }

    if (!uuid) {
      return {
        tenant_id: input.tenantId,
        artist_id: input.artistId,
        platform: 'soundcloud',
        external_id: slug,
        external_url: input.externalUrl ?? `https://soundcloud.com/${slug}`,
        display_name: null,
        username: slug,
        profile_url: input.externalUrl ?? `https://soundcloud.com/${slug}`,
        image_url: null,
        followers: null,
        subscribers: null,
        monthly_listeners: null,
        popularity: null,
        total_views: null,
        total_videos: null,
        total_tracks: null,
        total_albums: null,
        raw_payload: soundchartsNotIndexedProvenance('soundcloud', [`/api/v2.9/artist/by-platform/soundcloud/${slug}`]),
        sync_status: 'success',
        last_synced_at: new Date(),
        last_error: null,
      };
    }

    // Phase 1.3: exact by-platform resolution of the REGISTERED slug is already the
    // primary identity proof (the Soundcharts endpoint resolves exactly
    // that identifier or returns 404 — never "another" identifier). Divergence
    // from the UUID resolved through other anchors (Spotify/YouTube/Deezer) is only
    // Soundcharts cataloguing fragmentation — it never blocks the metric
    // of the account the artist actually registered (real finding: SoundCloud
    // "deejaystay" and the "canonical" entity via Spotify are two distinct
    // Soundcharts entities for the same artist; the "deejaystay" metric is
    // valid anyway).
    const crossPlatform = await evaluateCrossPlatformEvidence(this.soundcharts, input.canonicalUrls, 'soundcloud', uuid);

    const followers = await this.soundcharts.getSoundCloudFollowers(uuid);

    return {
      tenant_id: input.tenantId,
      artist_id: input.artistId,
      platform: 'soundcloud',
      external_id: slug,
      external_url: input.externalUrl ?? `https://soundcloud.com/${slug}`,
      display_name: null,
      username: slug,
      profile_url: input.externalUrl ?? `https://soundcloud.com/${slug}`,
      image_url: null,
      followers: followers.value,
      subscribers: null,
      monthly_listeners: null,
      popularity: null,
      total_views: null,
      total_videos: null,
      total_tracks: null,
      total_albums: null,
      raw_payload: {
        soundcharts_uuid: uuid,
        observed_at: followers.observedAt.toISOString(),
        ...primaryIdentityProvenance(crossPlatform),
        ...soundchartsProvenance('soundcloud', followers),
      },
      sync_status: 'success',
      last_synced_at: new Date(),
      last_error: null,
    };
  }

  /** Accepts only profile URLs (a single segment), never a track/playlist. */
  private extractSlug(value: string): string | null {
    const trimmed = value.trim();
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i);
    return match?.[1] ?? null;
  }
}
