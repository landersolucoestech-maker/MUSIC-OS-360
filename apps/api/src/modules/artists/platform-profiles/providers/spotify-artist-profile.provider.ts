import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  ArtistPlatformProvider,
  ArtistPlatformProviderInput,
  SocialPlatformProfileSnapshot,
} from '../social-platform-sync.types';
import { parseSpotifyArtistId } from '../../../integrations/spotify/spotify-url.util';
import { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import { primaryIdentityProvenance, soundchartsNotIndexedProvenance, soundchartsProvenance } from '../soundcharts-provenance.util';
import { evaluateCrossPlatformEvidence } from '../soundcharts-canonical-candidates.util';

/**
 * Fonte única do card "Ouvintes": Soundcharts /streaming/spotify/listening —
 * a API pública do Spotify não expõe monthly listeners (só followers), então
 * não há dependência dupla a resolver aqui. Nunca alimentar "Ouvintes" com
 * followers (Soundcharts 05).
 */
@Injectable()
export class SpotifyArtistProfileProvider implements ArtistPlatformProvider {
  readonly platform = 'spotify' as const;

  constructor(private readonly soundcharts: SoundchartsService) {}

  async isConfigured(_tenantId?: string): Promise<boolean> {
    return this.soundcharts.isConfigured();
  }

  async resolve(input: ArtistPlatformProviderInput): Promise<SocialPlatformProfileSnapshot> {
    if (!(await this.isConfigured())) {
      throw new ServiceUnavailableException(
        'Spotify (Soundcharts) não configurado: defina SOUNDCHARTS_CLIENT_ID e SOUNDCHARTS_CLIENT_SECRET no ambiente da API',
      );
    }

    const artistId = input.externalId ?? parseSpotifyArtistId(input.externalUrl ?? '');
    if (!artistId) throw new Error('Spotify artist id ausente ou inválido');

    // find-4e35ea8e: um artistId do Spotify resolvido com sucesso (existe de
    // verdade) mas não indexado na Soundcharts é uma resposta 404 VÁLIDA
    // (mesmo padrão já aplicado em Instagram/TikTok/Apple Music/YouTube) —
    // nunca sync_status=failed ("Erro"), sempre success com as métricas null
    // ("Indisponível" na UI).
    let uuid: string | null = null;
    try {
      uuid = await this.soundcharts.resolveArtistByPlatform('spotify', artistId);
    } catch (err) {
      if (!(err instanceof SoundchartsNotFoundError)) throw err;
    }

    if (!uuid) {
      return {
        tenant_id: input.tenantId,
        artist_id: input.artistId,
        platform: 'spotify',
        external_id: artistId,
        external_url: input.externalUrl ?? `https://open.spotify.com/artist/${artistId}`,
        display_name: null,
        username: null,
        profile_url: input.externalUrl ?? `https://open.spotify.com/artist/${artistId}`,
        image_url: null,
        followers: null,
        subscribers: null,
        monthly_listeners: null,
        popularity: null,
        total_views: null,
        total_videos: null,
        total_tracks: null,
        total_albums: null,
        raw_payload: soundchartsNotIndexedProvenance('spotify', [`/api/v2.9/artist/by-platform/spotify/${artistId}`]),
        sync_status: 'success',
        last_synced_at: new Date(),
        last_error: null,
      };
    }

    // Fase 1.3: resolução exata by-platform do artistId cadastrado já é a
    // prova de identidade primária. Divergência cross-platform vs
    // YouTube/Deezer/SoundCloud é só diagnóstico — nunca bloqueia.
    const crossPlatform = await evaluateCrossPlatformEvidence(this.soundcharts, input.canonicalUrls, 'spotify', uuid);

    const listeners = await this.soundcharts.getSpotifyMonthlyListeners(uuid);

    return {
      tenant_id: input.tenantId,
      artist_id: input.artistId,
      platform: 'spotify',
      external_id: artistId,
      external_url: input.externalUrl ?? `https://open.spotify.com/artist/${artistId}`,
      display_name: null,
      username: null,
      profile_url: input.externalUrl ?? `https://open.spotify.com/artist/${artistId}`,
      image_url: null,
      followers: null,
      subscribers: null,
      monthly_listeners: listeners.value,
      popularity: null,
      total_views: null,
      total_videos: null,
      total_tracks: null,
      total_albums: null,
      raw_payload: {
        soundcharts_uuid: uuid,
        observed_at: listeners.observedAt.toISOString(),
        ...primaryIdentityProvenance(crossPlatform),
        ...soundchartsProvenance('spotify', listeners),
      },
      sync_status: 'success',
      last_synced_at: new Date(),
      last_error: null,
    };
  }
}
