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
 * Single source of the Deezer fans card: Soundcharts /audience/deezer — the
 * public Deezer API (nb_fan) is no longer used here, to avoid keeping two
 * competing sources for the same card (Soundcharts 05).
 */
@Injectable()
export class DeezerArtistProfileProvider implements ArtistPlatformProvider {
  readonly platform = 'deezer' as const;

  constructor(private readonly soundcharts: SoundchartsService) {}

  async isConfigured(_tenantId?: string): Promise<boolean> {
    return this.soundcharts.isConfigured();
  }

  async resolve(input: ArtistPlatformProviderInput): Promise<SocialPlatformProfileSnapshot> {
    if (!(await this.isConfigured())) {
      throw new ServiceUnavailableException(
        'Deezer (Soundcharts) não configurado: defina SOUNDCHARTS_CLIENT_ID e SOUNDCHARTS_CLIENT_SECRET no ambiente da API',
      );
    }

    const artistId = input.externalId ?? this.extractArtistId(input.externalUrl ?? '');
    if (!artistId) throw new Error('Deezer artist id ausente ou inválido');

    // find-4e35ea8e: a Deezer artistId that resolves successfully (it really
    // exists) but is not indexed on Soundcharts is a VALID 404 response
    // (same pattern already applied to Instagram/TikTok/Apple Music/YouTube) —
    // never sync_status=failed ("Erro"), always success with null metrics
    // ("Indisponível" in the UI).
    let uuid: string | null = null;
    try {
      uuid = await this.soundcharts.resolveArtistByPlatform('deezer', artistId);
    } catch (err) {
      if (!(err instanceof SoundchartsNotFoundError)) throw err;
    }

    if (!uuid) {
      return {
        tenant_id: input.tenantId,
        artist_id: input.artistId,
        platform: 'deezer',
        external_id: artistId,
        external_url: input.externalUrl ?? `https://www.deezer.com/artist/${artistId}`,
        display_name: null,
        username: null,
        profile_url: input.externalUrl ?? `https://www.deezer.com/artist/${artistId}`,
        image_url: null,
        followers: null,
        subscribers: null,
        monthly_listeners: null,
        popularity: null,
        total_views: null,
        total_videos: null,
        total_tracks: null,
        total_albums: null,
        raw_payload: soundchartsNotIndexedProvenance('deezer', [`/api/v2.9/artist/by-platform/deezer/${artistId}`]),
        sync_status: 'success',
        last_synced_at: new Date(),
        last_error: null,
      };
    }

    // Phase 1.3: exact by-platform resolution of the registered artistId is already the
    // primary identity proof. Cross-platform divergence is diagnostic.
    const crossPlatform = await evaluateCrossPlatformEvidence(this.soundcharts, input.canonicalUrls, 'deezer', uuid);

    const fans = await this.soundcharts.getDeezerFans(uuid);

    return {
      tenant_id: input.tenantId,
      artist_id: input.artistId,
      platform: 'deezer',
      external_id: artistId,
      external_url: input.externalUrl ?? `https://www.deezer.com/artist/${artistId}`,
      display_name: null,
      username: null,
      profile_url: input.externalUrl ?? `https://www.deezer.com/artist/${artistId}`,
      image_url: null,
      followers: fans.value,
      subscribers: null,
      monthly_listeners: null,
      popularity: null,
      total_views: null,
      total_videos: null,
      total_tracks: null,
      total_albums: null,
      raw_payload: {
        soundcharts_uuid: uuid,
        observed_at: fans.observedAt.toISOString(),
        ...primaryIdentityProvenance(crossPlatform),
        ...soundchartsProvenance('deezer', fans),
      },
      sync_status: 'success',
      last_synced_at: new Date(),
      last_error: null,
    };
  }

  private extractArtistId(value: string): string | null {
    if (!value) return null;
    const urlMatch = value.match(/artist\/(\d+)/);
    if (urlMatch?.[1]) return urlMatch[1];
    return /^\d+$/.test(value) ? value : null;
  }
}
