import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ArtistPlatformProvider,
  ArtistPlatformProviderInput,
  SocialPlatformProfileSnapshot,
} from '../social-platform-sync.types';
import { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import { primaryIdentityProvenance, soundchartsNotIndexedProvenance, soundchartsProvenance } from '../soundcharts-provenance.util';
import { evaluateCrossPlatformEvidence } from '../soundcharts-canonical-candidates.util';
import { parseYoutubeRef } from '../youtube-ref.util';
import { CircuitBreaker } from '../../../../core/resilience/circuit-breaker';
import { resilientFetch } from '../../../../core/resilience/resilient-fetch';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

/**
 * REGRA "SOUNDCHARTS ONLY" (auditoria 2026-08-31): subscribers, total_views
 * e total_videos vêm TODOS de uma única chamada a Soundcharts
 * /audience/youtube (SoundchartsService.getYouTubeAudience) — confirmado
 * contra a API real que o mesmo item da série traz followerCount, postCount
 * e viewCount juntos. A YouTube Data API deixou de ser usada para métricas
 * (a antiga chamada a channels?part=statistics foi removida); ela continua
 * existindo aqui SOMENTE para RESOLUÇÃO DE IDENTIDADE — transformar o link
 * cadastrado (handle/@handle/URL customizada) no channelId exato (UC…) que a
 * Soundcharts exige para resolver a conta. Nenhuma chamada feita por
 * `resolveChannelId`/`parseRef` lê `part=statistics` nem qualquer campo de
 * métrica — é puramente id lookup, o mesmo tipo de normalização de URL que
 * cada provider já faz para seu próprio link cadastrado.
 */
@Injectable()
export class YouTubeArtistProfileProvider implements ArtistPlatformProvider {
  readonly platform = 'youtube' as const;
  private readonly logger = new Logger(YouTubeArtistProfileProvider.name);
  // find-f0730ed7: guarded fetch (timeout + circuit breaker) — same pattern as
  // YouTubeService (integrations/youtube/youtube.service.ts) for the raw YouTube
  // Data API calls this provider makes for channel-id identity resolution.
  private readonly cb = new CircuitBreaker({ name: YouTubeArtistProfileProvider.name });
  private fetch(url: string, init?: RequestInit): Promise<Response> {
    return resilientFetch(this.cb, url, init);
  }

  constructor(
    private readonly config: ConfigService,
    private readonly soundcharts: SoundchartsService,
  ) {}

  async isConfigured(_tenantId?: string): Promise<boolean> {
    return !!this.config.get<string>('YOUTUBE_API_KEY') && this.soundcharts.isConfigured();
  }

  async resolve(input: ArtistPlatformProviderInput): Promise<SocialPlatformProfileSnapshot> {
    if (!(await this.isConfigured())) {
      throw new ServiceUnavailableException(
        'YouTube não configurado: defina YOUTUBE_API_KEY, SOUNDCHARTS_CLIENT_ID e SOUNDCHARTS_CLIENT_SECRET no ambiente da API',
      );
    }

    const apiKey = this.config.get<string>('YOUTUBE_API_KEY') ?? '';
    const ref = this.parseRef(input.externalId ?? input.externalUrl ?? '');
    if (!ref) throw new Error('YouTube channel ref ausente ou inválido');
    const channelId = await this.resolveChannelId(ref, apiKey);
    if (!channelId) throw new Error('Canal do YouTube não encontrado para o link informado');

    // find-4e35ea8e: um canal do YouTube resolvido com sucesso (existe de
    // verdade) mas não indexado na Soundcharts é uma resposta 404 VÁLIDA
    // (Soundcharts 07, mesmo padrão já aplicado em Instagram/TikTok/Apple
    // Music) — nunca sync_status=failed ("Erro"), sempre success com as
    // métricas null ("Indisponível" na UI).
    let uuid: string | null = null;
    try {
      uuid = await this.soundcharts.resolveArtistByPlatform('youtube', channelId);
    } catch (err) {
      if (!(err instanceof SoundchartsNotFoundError)) throw err;
    }

    if (!uuid) {
      return {
        tenant_id: input.tenantId,
        artist_id: input.artistId,
        platform: 'youtube',
        external_id: channelId,
        external_url: input.externalUrl ?? `https://www.youtube.com/channel/${channelId}`,
        display_name: null,
        username: null,
        profile_url: `https://www.youtube.com/channel/${channelId}`,
        image_url: null,
        followers: null,
        subscribers: null,
        monthly_listeners: null,
        popularity: null,
        total_views: null,
        total_videos: null,
        total_tracks: null,
        total_albums: null,
        raw_payload: soundchartsNotIndexedProvenance('youtube', [`/api/v2.9/artist/by-platform/youtube/${channelId}`]),
        sync_status: 'success',
        last_synced_at: new Date(),
        last_error: null,
      };
    }

    // Fase 1.3: resolução exata by-platform do channelId cadastrado já é a
    // prova de identidade primária. Divergência cross-platform é diagnóstico.
    const crossPlatform = await evaluateCrossPlatformEvidence(this.soundcharts, input.canonicalUrls, 'youtube', uuid);

    const audience = await this.soundcharts.getYouTubeAudience(uuid);
    const { subscribers, videos, views } = audience;

    return {
      tenant_id: input.tenantId,
      artist_id: input.artistId,
      platform: 'youtube',
      external_id: channelId,
      external_url: input.externalUrl ?? `https://www.youtube.com/channel/${channelId}`,
      display_name: null,
      username: null,
      profile_url: `https://www.youtube.com/channel/${channelId}`,
      image_url: null,
      followers: null,
      subscribers: subscribers.value,
      monthly_listeners: null,
      popularity: null,
      total_views: views ? String(views.value) : null,
      total_videos: videos ? videos.value : null,
      total_tracks: null,
      total_albums: null,
      raw_payload: {
        soundcharts_uuid: uuid,
        observed_at: subscribers.observedAt.toISOString(),
        ...primaryIdentityProvenance(crossPlatform),
        // subscribers/views/videos vêm TODOS da mesma chamada Soundcharts
        // /audience/youtube — nenhuma métrica deste card usa YouTube Data
        // API (auditoria 2026-08-31, regra "SOUNDCHARTS ONLY").
        subscribers_provenance: soundchartsProvenance('youtube', subscribers),
        views_videos_provenance: {
          source_provider: 'soundcharts',
          source_platform: 'youtube',
          source_endpoint: views?.endpoint ?? videos?.endpoint ?? subscribers.endpoint,
          source_field: 'items[].{postCount,viewCount}',
          fetched_at: subscribers.observedAt.toISOString(),
          normalized_at: new Date().toISOString(),
          raw_value: { viewCount: views?.value ?? null, postCount: videos?.value ?? null },
          normalized_value: { total_views: views?.value ?? null, total_videos: videos?.value ?? null },
        },
      },
      sync_status: 'success',
      last_synced_at: new Date(),
      last_error: null,
    };
  }

  /**
   * Parses any YouTube identifier/URL into a typed channel reference.
   * Supports: bare `UC…` id, `@handle`, and URLs `/channel/UC…`, `/@handle`,
   * `/user/NAME` (legacy), `/c/NAME` (custom) and bare `/NAME` (legacy custom).
   */
  parseRef(raw: string): { kind: 'id' | 'handle' | 'username' | 'custom'; value: string } | null {
    return parseYoutubeRef(raw);
  }

  /** Resolves a typed reference to a concrete `UC…` channel id via the YouTube Data API. */
  private async resolveChannelId(
    ref: { kind: 'id' | 'handle' | 'username' | 'custom'; value: string },
    apiKey: string,
  ): Promise<string | null> {
    if (ref.kind === 'id') return ref.value;

    if (ref.kind === 'handle' || ref.kind === 'username') {
      const param =
        ref.kind === 'handle'
          ? `forHandle=@${encodeURIComponent(ref.value)}`
          : `forUsername=${encodeURIComponent(ref.value)}`;
      const res = await this.fetch(`${YOUTUBE_API}/channels?part=id&${param}&key=${apiKey}`);
      if (!res.ok) throw new Error(await this.describeYouTubeError(res, `resolver o canal por ${ref.kind}`));
      const data = (await res.json()) as { items?: Array<{ id?: string }> };
      const id = data.items?.[0]?.id;
      if (id) return id;
      if (ref.kind === 'username') return null;
      // handle not resolvable via forHandle → fall through to search
    }

    // custom (/c/NAME) or unresolved handle → search the channel by name
    const res = await this.fetch(
      `${YOUTUBE_API}/search?part=id&type=channel&maxResults=1&q=${encodeURIComponent(ref.value)}&key=${apiKey}`,
    );
    if (!res.ok) throw new Error(await this.describeYouTubeError(res, `pesquisar o canal "${ref.value}"`));
    const data = (await res.json()) as { items?: Array<{ id?: { channelId?: string } }> };
    return data.items?.[0]?.id?.channelId ?? null;
  }

  /**
   * Erro específico da YouTube Data API: status + reason/message do corpo
   * (ex.: 403 quotaExceeded, 400 API key not valid) — nunca um genérico.
   */
  private async describeYouTubeError(res: Response, action: string): Promise<string> {
    let reason = '';
    try {
      const body = (await res.json()) as {
        error?: { message?: string; errors?: Array<{ reason?: string }> };
      };
      const apiReason = body.error?.errors?.[0]?.reason;
      const apiMessage = body.error?.message;
      reason = [apiReason, apiMessage].filter(Boolean).join(' — ');
    } catch { /* corpo não-JSON: mantém só o status */ }
    return `YouTube API respondeu ${res.status} ao ${action}${reason ? `: ${reason}` : ''}`;
  }
}
