import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  ArtistPlatformProvider,
  ArtistPlatformProviderInput,
  SocialPlatformProfileSnapshot,
} from '../social-platform-sync.types';
import { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import { checkRegisteredHandleAgainstRegistry, resolveCanonicalUuidForProvider } from '../soundcharts-canonical-candidates.util';
import { soundchartsNotIndexedProvenance, soundchartsProvenance } from '../soundcharts-provenance.util';
import { extractAppleMusicId } from '../apple-music-url.util';

/**
 * Apple Music has no audience/listeners in Soundcharts (see
 * SoundchartsService.getAppleMusicPlaylistCount for the verified
 * endpoints). The only real and honest metric available is the count of
 * Apple Music playlists that include the artist — editorial presence, not
 * audience. That is why it NEVER goes into followers/subscribers/monthly_listeners
 * (those fields stay null); it lives only in raw_payload.playlist_count, and the
 * frontend labels the card "Playlists", never "Ouvintes"/"Seguidores"
 * (Soundcharts 07).
 *
 * Phase 1.3 — PRIMARY: exact by-platform resolution of the REGISTERED Apple Music ID
 * (the same identity proof spotify/youtube/deezer/soundcloud
 * already use) — closes the gap reported in Phase 1.2, where the entity used always
 * came from the canonical UUID without ever trying the registered ID directly. It
 * falls back to the canonical entity only if the registered ID does not resolve on its own, and even then
 * requires confirmation in the registry before labelling it as verified.
 */
@Injectable()
export class AppleMusicArtistProfileProvider implements ArtistPlatformProvider {
  readonly platform = 'apple-music' as const;

  constructor(private readonly soundcharts: SoundchartsService) {}

  async isConfigured(_tenantId?: string): Promise<boolean> {
    return this.soundcharts.isConfigured();
  }

  async resolve(input: ArtistPlatformProviderInput): Promise<SocialPlatformProfileSnapshot> {
    if (!(await this.isConfigured())) {
      throw new ServiceUnavailableException(
        'Apple Music (Soundcharts) não configurado: defina SOUNDCHARTS_CLIENT_ID e SOUNDCHARTS_CLIENT_SECRET no ambiente da API',
      );
    }

    const appleId = input.externalId ?? extractAppleMusicId(input.externalUrl ?? '');
    if (!appleId) throw new Error('Apple Music artist id missing or invalid');

    // PRIMARY: exact resolution by the registered Apple Music ID.
    let uuid: string | null = null;
    let primaryIdentityStatus: 'VERIFIED_EXACT' | 'INSUFFICIENT_EVIDENCE' = 'VERIFIED_EXACT';
    try {
      uuid = await this.soundcharts.resolveArtistByPlatform('apple-music', appleId);
    } catch (err) {
      if (!(err instanceof SoundchartsNotFoundError)) throw err;
    }

    if (!uuid) {
      // SECONDARY: registered ID not indexed standalone — falls back to the canonical
      // UUID, confirming in the registry before labelling it as verified.
      uuid = await resolveCanonicalUuidForProvider(this.soundcharts, input.canonicalUrls, 'apple-music', appleId);
      const registryStatus = await checkRegisteredHandleAgainstRegistry(this.soundcharts, uuid, 'apple-music', appleId);
      primaryIdentityStatus = registryStatus === 'CONFIRMED' ? 'VERIFIED_EXACT' : 'INSUFFICIENT_EVIDENCE';
    }

    // "No playlist found" is a valid Soundcharts response (not an
    // integration error) — a successful sync with playlist_count null; the
    // card shows "Indisponível", never "Erro" (same convention as
    // Spotify's monthly_listeners).
    let playlistCount: number | null = null;
    let observedAt = new Date();
    let provenance: ReturnType<typeof soundchartsProvenance> | ReturnType<typeof soundchartsNotIndexedProvenance>;
    try {
      const metric = await this.soundcharts.getAppleMusicPlaylistCount(uuid);
      playlistCount = metric.value;
      observedAt = metric.observedAt;
      provenance = soundchartsProvenance('apple-music', metric);
    } catch (err) {
      if (!(err instanceof SoundchartsNotFoundError)) throw err;
      provenance = soundchartsNotIndexedProvenance('apple-music', [`/api/v2/artist/${uuid}/playlist/reach/apple-music`]);
    }

    return {
      tenant_id: input.tenantId,
      artist_id: input.artistId,
      platform: 'apple-music',
      external_id: appleId,
      external_url: input.externalUrl ?? `https://music.apple.com/artist/${appleId}`,
      display_name: null,
      username: null,
      profile_url: input.externalUrl ?? `https://music.apple.com/artist/${appleId}`,
      image_url: null,
      followers: null,
      subscribers: null,
      monthly_listeners: null,
      popularity: null,
      total_views: null,
      total_videos: null,
      total_tracks: null,
      total_albums: null,
      raw_payload: {
        soundcharts_uuid: uuid,
        playlist_count: playlistCount,
        observed_at: observedAt.toISOString(),
        // Confirmed by a direct call to the real API (2026-08-31 audit):
        // /audience/apple-music answers "not a social platform" — Soundcharts
        // genuinely has no audience metric for Apple
        // Music. playlist_count is the only real metric available (editorial
        // presence, not audience) — it never becomes followers/subscribers.
        audience_metric_availability: 'SOURCE_DOES_NOT_PROVIDE_METRIC',
        primary_identity_status: primaryIdentityStatus,
        ...provenance,
      },
      sync_status: 'success',
      last_synced_at: new Date(),
      last_error: null,
    };
  }
}
