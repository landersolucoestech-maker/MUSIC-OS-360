import { Injectable, Logger } from '@nestjs/common';
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
import { integrationNotConfigured } from '../../../../core/errors/integration-not-configured';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

/**
 * "SOUNDCHARTS ONLY" RULE (2026-08-31 audit): subscribers, total_views
 * and total_videos ALL come from a single call to Soundcharts
 * /audience/youtube (SoundchartsService.getYouTubeAudience) — confirmed
 * against the real API that the same series item carries followerCount, postCount
 * and viewCount together. The YouTube Data API is no longer used for metrics
 * (the old channels?part=statistics call was removed); it still
 * exists here ONLY for IDENTITY RESOLUTION — turning the registered
 * link (handle/@handle/custom URL) into the exact channelId (UC…) that
 * Soundcharts requires to resolve the account. No call made by
 * `resolveChannelId`/`parseRef` reads `part=statistics` or any metric
 * field — it is purely an id lookup, the same kind of URL normalization
 * every provider already does for its own registered link.
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
      throw integrationNotConfigured('YouTube', 'YOUTUBE_NOT_CONFIGURED', ['YOUTUBE_API_KEY', 'SOUNDCHARTS_CLIENT_ID', 'SOUNDCHARTS_CLIENT_SECRET']);
    }

    const apiKey = this.config.get<string>('YOUTUBE_API_KEY') ?? '';
    const ref = this.parseRef(input.externalId ?? input.externalUrl ?? '');
    if (!ref) throw new Error('YouTube channel ref missing or invalid');
    const channelId = await this.resolveChannelId(ref, apiKey);
    if (!channelId) throw new Error('YouTube channel not found for the given link');

    // find-4e35ea8e: a YouTube channel resolved successfully (it really
    // exists) but not indexed in Soundcharts is a VALID 404 response
    // (Soundcharts 07, same pattern already applied to Instagram/TikTok/Apple
    // Music) — never sync_status=failed ("Erro"), always success with
    // null metrics ("Indisponível" in the UI).
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

    // Phase 1.3: exact by-platform resolution of the registered channelId is already the
    // primary identity proof. Cross-platform divergence is diagnostic.
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
        // subscribers/views/videos ALL come from the same Soundcharts call
        // /audience/youtube — no metric of this card uses the YouTube Data
        // API (2026-08-31 audit, "SOUNDCHARTS ONLY" rule).
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
      if (!res.ok) throw new Error(await this.describeYouTubeError(res, `resolving the channel by ${ref.kind}`));
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
    if (!res.ok) throw new Error(await this.describeYouTubeError(res, `searching the channel "${ref.value}"`));
    const data = (await res.json()) as { items?: Array<{ id?: { channelId?: string } }> };
    return data.items?.[0]?.id?.channelId ?? null;
  }

  /**
   * Specific YouTube Data API error: status + reason/message from the body
   * (e.g. 403 quotaExceeded, 400 API key not valid) — never a generic one.
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
    } catch { /* non-JSON body: keep only the status */ }
    return `YouTube API responded ${res.status} while ${action}${reason ? `: ${reason}` : ''}`;
  }
}
