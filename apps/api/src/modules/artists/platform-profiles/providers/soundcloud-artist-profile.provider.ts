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
 * Fonte única do card de seguidores do SoundCloud: Soundcharts
 * /audience/soundcloud. Não depende mais de SOUNDCLOUD_CLIENT_ID/SECRET —
 * essa credencial (integração SoundCloud própria) pode continuar existindo
 * para outros usos, mas não bloqueia mais Métricas das Plataformas
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
    if (!slug) throw new Error('SoundCloud profile slug ausente ou inválido');

    // find-4e35ea8e: um slug do SoundCloud resolvido com sucesso (existe de
    // verdade) mas não indexado na Soundcharts é uma resposta 404 VÁLIDA
    // (mesmo padrão já aplicado em Instagram/TikTok/Apple Music/YouTube) —
    // nunca sync_status=failed ("Erro"), sempre success com as métricas null
    // ("Indisponível" na UI).
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

    // Fase 1.3: a resolução exata by-platform do slug CADASTRADO já é a prova
    // de identidade primária (o endpoint da Soundcharts resolve exatamente
    // esse identifier ou retorna 404 — nunca "outro" identifier). Divergência
    // do UUID resolvido por outras âncoras (Spotify/YouTube/Deezer) é só
    // fragmentação de catalogação da Soundcharts — nunca bloqueia a métrica
    // da conta que o artista efetivamente cadastrou (achado real: SoundCloud
    // "deejaystay" e a entidade "canônica" via Spotify são duas entidades
    // Soundcharts distintas para o mesmo artista; a métrica de "deejaystay" é
    // válida mesmo assim).
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

  /** Só aceita URLs de perfil (um único segmento), nunca faixa/playlist. */
  private extractSlug(value: string): string | null {
    const trimmed = value.trim();
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i);
    return match?.[1] ?? null;
  }
}
