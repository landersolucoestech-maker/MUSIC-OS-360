/**
 * modules/integrations/soundcharts/soundcharts.service.ts
 *
 * Isolated client for the Soundcharts API — source of public artist
 * audience metrics (see Soundcharts 02: real credentials validated,
 * OAuth2 client_credentials auth confirmed against the official documentation
 * before any call).
 *
 * Wired to ArtistPlatformProfile/artist-external-profile-sync — the 7
 * providers in artists/platform-profiles/providers/* delegate to this client.
 *
 * Credentials: SOUNDCHARTS_CLIENT_ID/SOUNDCHARTS_CLIENT_SECRET are global
 * (one Soundcharts account for all of Music OS 360, not per tenant) — which is
 * why they are read via ConfigService (the application's global env), instead of the
 * IntegrationBaseService per-tenant credentials flow (which does not apply
 * here).
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CircuitBreaker } from '../../../core/resilience/circuit-breaker';
import { resilientFetch } from '../../../core/resilience/resilient-fetch';
import { assertAllowedHost, assertSafePathSegment } from '../../../core/resilience/safe-url';
import type { SoundchartsMetric } from './soundcharts.types';
import {
  SoundchartsNotConfiguredError,
  SoundchartsApiError,
  SoundchartsNotFoundError,
  SoundchartsRateLimitError,
} from './soundcharts.errors';

const TOKEN_URL = 'https://account.soundcharts.com/oauth/token';
const API_BASE = 'https://customer.api.soundcharts.com';
const ALLOWED_HOSTS = ['account.soundcharts.com', 'customer.api.soundcharts.com'] as const;

// Renews a little before the real expires_in returned by Soundcharts, so
// a token that expires mid-flight is never used in a call.
const TOKEN_REFRESH_SKEW_MS = 30_000;
const DEFAULT_TOKEN_TTL_S = 900; // fallback only when the response omits expires_in

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms, with the renewal skew already applied
}

interface CachedUuid {
  uuid: string;
  expiresAt: number;
}

// Reuse of the UUID resolved by (platform, externalId) for a short window
// — avoids repeating /artist/by-platform/... when several platforms of the same
// artist are synced in sequence (Soundcharts 06).
const UUID_CACHE_TTL_MS = 5 * 60 * 1000;

interface SeriesItem {
  date?: string;
  value?: number;
  followerCount?: number;
  playlistCount?: number;
  postCount?: number;
  viewCount?: number;
}

@Injectable()
export class SoundchartsService {
  private readonly logger = new Logger(SoundchartsService.name);
  private readonly cb = new CircuitBreaker({ name: 'SoundchartsService' });
  private cachedToken: CachedToken | null = null;
  private readonly uuidCache = new Map<string, CachedUuid>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!(this.config.get<string>('SOUNDCHARTS_CLIENT_ID') && this.config.get<string>('SOUNDCHARTS_CLIENT_SECRET'));
  }

  // ── Authentication (client_credentials, cached until close to expiry) ────

  private async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const clientId = this.config.get<string>('SOUNDCHARTS_CLIENT_ID');
    const clientSecret = this.config.get<string>('SOUNDCHARTS_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new SoundchartsNotConfiguredError();
    }

    const url = assertAllowedHost(TOKEN_URL, ALLOWED_HOSTS);
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await resilientFetch(this.cb, url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      // Never log the token response body — it may echo client_secret on auth errors.
      throw new SoundchartsApiError(`Soundcharts token request falhou: HTTP ${res.status}`, res.status);
    }

    let body: { access_token?: string; expires_in?: number; token_type?: string } | null = null;
    try { body = await res.json(); } catch { /* response without a JSON body */ }

    if (!body?.access_token) {
      throw new SoundchartsApiError('Soundcharts token response without access_token', res.status);
    }

    const ttlS = typeof body.expires_in === 'number' ? body.expires_in : DEFAULT_TOKEN_TTL_S;
    this.cachedToken = {
      token: body.access_token,
      expiresAt: Date.now() + ttlS * 1000 - TOKEN_REFRESH_SKEW_MS,
    };
    return this.cachedToken.token;
  }

  // ── Internal HTTP ──────────────────────────────────────────────────────

  private async apiGet(path: string): Promise<{ status: number; body: unknown }> {
    const token = await this.getToken();
    const url = assertAllowedHost(`${API_BASE}${path}`, ALLOWED_HOSTS);
    const res = await resilientFetch(this.cb, url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let body: unknown = null;
    try { body = await res.json(); } catch { /* response without a JSON body */ }
    return { status: res.status, body };
  }

  private throwForStatus(status: number, context: string): never {
    if (status === 404) throw new SoundchartsNotFoundError(`Soundcharts: not found in ${context}`, status);
    if (status === 429) throw new SoundchartsRateLimitError(`Soundcharts: rate limit em ${context}`, status);
    throw new SoundchartsApiError(`Soundcharts responded HTTP ${status} in ${context}`, status);
  }

  /**
   * Full registry of external identifiers that Soundcharts has already associated
   * with a UUID — used for identity investigation (Metrics Phase 1.1):
   * shows ALL platforms Soundcharts knows for this
   * artist, not only the one currently being resolved. Never used to
   * resolve a UUID automatically — it is evidence for an identity decision,
   * not a resolver on its own.
   */
  async getArtistIdentifiers(uuid: string): Promise<{ raw: unknown; identifiers: Array<{ platform: string; identifier: string }> }> {
    const id = assertSafePathSegment(uuid, 'uuid');
    const { status, body } = await this.apiGet(`/api/v2/artist/${id}/identifiers`);
    if (status === 404) return { raw: body, identifiers: [] };
    if (status !== 200) this.throwForStatus(status, `getArtistIdentifiers(${id})`);
    const items =
      (body as { items?: Array<{ platformCode?: string; identifier?: string }> } | null)?.items ??
      (Array.isArray(body) ? (body as Array<{ platformCode?: string; identifier?: string }>) : []);
    return {
      raw: body,
      identifiers: items
        .filter((i): i is { platformCode: string; identifier: string } => !!i?.platformCode && !!i?.identifier)
        .map((i) => ({ platform: i.platformCode, identifier: i.identifier })),
    };
  }

  /**
   * Related/similar artists according to Soundcharts' own similarity
   * algorithm (Phase 3.1 — discovery of real market candidates
   * for the Market Benchmark). Confirmed live (DJ Stay, 2026-08-31):
   * `/related` returns `{items:[{uuid,slug,name,appUrl,imageUrl}], page:{offset,limit,next,previous,total}}` —
   * paginated (offset/limit), no genre/country in the item (needs a separate
   * getArtistProfile(uuid) for that). It is "candidate discovery", not
   * a statistically validated cohort on its own — the caller (Market
   * Benchmark) decides the inclusion criteria.
   */
  async getRelatedArtists(uuid: string, offset = 0, limit = 100): Promise<{ items: Array<{ uuid: string; name: string }>; total: number }> {
    const id = assertSafePathSegment(uuid, 'uuid');
    const { status, body } = await this.apiGet(`/api/v2/artist/${id}/related?offset=${offset}&limit=${limit}`);
    if (status === 404) return { items: [], total: 0 };
    if (status !== 200) this.throwForStatus(status, 'getRelatedArtists');
    const parsed = body as { items?: Array<{ uuid?: string; name?: string }>; page?: { total?: number } } | null;
    const items = (parsed?.items ?? [])
      .filter((i): i is { uuid: string; name: string } => !!i?.uuid && !!i?.name)
      .map((i) => ({ uuid: i.uuid, name: i.name }));
    return { items, total: parsed?.page?.total ?? items.length };
  }

  /**
   * Shallow artist profile by UUID (Phase 3.1) — used only for
   * `countryCode` when filtering the market cohort. Confirmed live:
   * `GET /api/v2/artist/{uuid}` returns `countryCode` (string, may be empty
   * when Soundcharts lacks that information — never invent a country).
   */
  async getArtistCountryCode(uuid: string): Promise<string | null> {
    const id = assertSafePathSegment(uuid, 'uuid');
    const { status, body } = await this.apiGet(`/api/v2/artist/${id}`);
    if (status !== 200) return null;
    const countryCode = (body as { object?: { countryCode?: string } } | null)?.object?.countryCode;
    return typeof countryCode === 'string' && countryCode.length > 0 ? countryCode : null;
  }

  /**
   * Searches artists by name/query — auxiliary evidence for identity
   * investigation (it never proves identity alone: an equal name is not a MATCH).
   */
  async searchArtists(query: string): Promise<{ raw: unknown; results: Array<{ uuid: string; name: string }> }> {
    const q = encodeURIComponent(query);
    const { status, body } = await this.apiGet(`/api/v2/artist/search/${q}`);
    if (status === 404) return { raw: body, results: [] };
    if (status !== 200) this.throwForStatus(status, `searchArtists(${query})`);
    const items =
      (body as { items?: Array<{ uuid?: string; name?: string }> } | null)?.items ??
      (Array.isArray(body) ? (body as Array<{ uuid?: string; name?: string }>) : []);
    return {
      raw: body,
      results: items
        .filter((i): i is { uuid: string; name: string } => !!i?.uuid && !!i?.name)
        .map((i) => ({ uuid: i.uuid, name: i.name })),
    };
  }

  /** Item with the most recent date — never assumes the array order (different endpoints sort differently). */
  private pickLatest(items: unknown): SeriesItem | null {
    if (!Array.isArray(items) || items.length === 0) return null;
    let latest: SeriesItem | null = null;
    let latestTime = -Infinity;
    for (const raw of items as SeriesItem[]) {
      const t = raw?.date ? new Date(raw.date).getTime() : NaN;
      if (!Number.isNaN(t) && t > latestTime) {
        latestTime = t;
        latest = raw;
      }
    }
    return latest;
  }

  /**
   * Phase 2 — extracts the FULL dated series from `items` (the same payload
   * `pickLatest` already receives) for the requested field, sorted by ascending
   * `observedAt`. Points without a valid date or without the numeric field are
   * silently discarded (not an error — they just do not become a series point).
   */
  private extractSeries(items: unknown, field: 'followerCount' | 'value' | 'playlistCount' | 'postCount' | 'viewCount'): Array<{ value: number; observedAt: Date }> {
    if (!Array.isArray(items)) return [];
    const out: Array<{ value: number; observedAt: Date }> = [];
    for (const raw of items as SeriesItem[]) {
      const value = raw?.[field];
      const t = raw?.date ? new Date(raw.date) : null;
      if (typeof value === 'number' && t && !Number.isNaN(t.getTime())) out.push({ value, observedAt: t });
    }
    out.sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
    return out;
  }

  // ── Artist resolution ────────────────────────────────────────────────

  async resolveArtistByPlatform(platform: string, externalId: string): Promise<string> {
    const p = assertSafePathSegment(platform, 'platform');
    const id = assertSafePathSegment(externalId, 'externalId');

    const cacheKey = `${p}:${id}`;
    const cached = this.uuidCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.uuid;

    const { status, body } = await this.apiGet(`/api/v2.9/artist/by-platform/${p}/${id}`);
    if (status !== 200) this.throwForStatus(status, `resolveArtistByPlatform(${p})`);

    const uuid = (body as { object?: { uuid?: string }; uuid?: string; data?: { uuid?: string } } | null)
      ?.object?.uuid
      ?? (body as { uuid?: string } | null)?.uuid
      ?? (body as { data?: { uuid?: string } } | null)?.data?.uuid;
    if (!uuid) throw new SoundchartsApiError('Soundcharts: response without artist uuid', status);

    this.uuidCache.set(cacheKey, { uuid, expiresAt: Date.now() + UUID_CACHE_TTL_MS });
    return uuid;
  }

  /**
   * Canonical resolution: tries the candidates in order (typically
   * spotify → youtube → deezer → soundcloud) and uses the first that resolves
   * — instead of each platform (e.g. Instagram/TikTok) resolving again
   * through its own handle, which is fragile when Soundcharts does not index
   * that specific handle even though it already has the artist via Spotify.
   * All metrics of the same artist must reuse the UUID returned
   * here (Soundcharts 06).
   */
  async resolveCanonicalArtistUuid(
    candidates: Array<{ platform: string; externalId: string | null | undefined }>,
  ): Promise<string> {
    const attempted: string[] = [];
    for (const candidate of candidates) {
      if (!candidate.externalId) continue;
      try {
        return await this.resolveArtistByPlatform(candidate.platform, candidate.externalId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempted.push(`${candidate.platform}: ${message}`);
      }
    }
    throw new SoundchartsApiError(
      attempted.length > 0
        ? `Soundcharts: could not resolve the artist by any available identifier (${attempted.join('; ')})`
        : 'Soundcharts: no artist identifier available for resolution',
      404,
    );
  }

  // ── Metrics ─────────────────────────────────────────────────────────────

  /**
   * Spotify monthly listeners — EXCLUSIVELY via /streaming/spotify/listening.
   * Using /audience/spotify here is forbidden: that endpoint returns followerCount
   * (followers), a different metric (confirmed in the real validation —
   * Soundcharts 02).
   */
  async getSpotifyMonthlyListeners(uuid: string): Promise<SoundchartsMetric> {
    const id = assertSafePathSegment(uuid, 'uuid');
    const endpoint = `/api/v2/artist/${id}/streaming/spotify/listening`;
    const { status, body } = await this.apiGet(endpoint);
    if (status !== 200) this.throwForStatus(status, 'getSpotifyMonthlyListeners');

    const items = (body as { items?: unknown } | null)?.items;
    const latest = this.pickLatest(items);
    if (!latest || typeof latest.value !== 'number') {
      throw new SoundchartsApiError('Soundcharts: monthly listeners series empty/without value', status);
    }
    return {
      value: latest.value,
      observedAt: latest.date ? new Date(latest.date) : new Date(),
      source: 'soundcharts',
      endpoint,
      field: 'items[].value',
      series: this.extractSeries(items, 'value'),
    };
  }

  private async getAudienceFollowerCount(uuid: string, platform: string, methodName: string): Promise<SoundchartsMetric> {
    const id = assertSafePathSegment(uuid, 'uuid');
    const endpoint = `/api/v2/artist/${id}/audience/${platform}`;
    const { status, body } = await this.apiGet(endpoint);
    if (status !== 200) this.throwForStatus(status, methodName);

    const items = (body as { items?: unknown } | null)?.items;
    const latest = this.pickLatest(items);
    if (!latest || typeof latest.followerCount !== 'number') {
      throw new SoundchartsApiError(`Soundcharts: followerCount missing in ${methodName}`, status);
    }
    return {
      value: latest.followerCount,
      observedAt: latest.date ? new Date(latest.date) : new Date(),
      source: 'soundcharts',
      endpoint,
      field: 'items[].followerCount',
      series: this.extractSeries(items, 'followerCount'),
    };
  }

  async getInstagramFollowers(uuid: string): Promise<SoundchartsMetric> {
    return this.getAudienceFollowerCount(uuid, 'instagram', 'getInstagramFollowers');
  }

  async getTikTokFollowers(uuid: string): Promise<SoundchartsMetric> {
    return this.getAudienceFollowerCount(uuid, 'tiktok', 'getTikTokFollowers');
  }

  /**
   * YouTube — 2026-08-31 audit ("SOUNDCHARTS ONLY" rule for platform
   * metrics): the SAME /audience/youtube that already returns followerCount
   * (subscribers) also returns, per series item, postCount and viewCount —
   * confirmed with a real call against the API (DJ Stay, uuid
   * 11e81bc0-69a1-279e-9fb0-a0369fe50396: postCount=277, viewCount=1,221,926
   * on 2026-08-31). This replaces the YouTube Data API
   * (channels?part=statistics) as the source of total_views/total_videos, which
   * violated the rule that platform metrics come exclusively from
   * Soundcharts — and does it with ONE call only (never two), the same one already
   * made for subscribers. postCount/viewCount missing from the real payload
   * (account without that data) become `null`, never an invented value.
   */
  async getYouTubeAudience(uuid: string): Promise<{
    subscribers: SoundchartsMetric;
    videos: SoundchartsMetric | null;
    views: SoundchartsMetric | null;
  }> {
    const id = assertSafePathSegment(uuid, 'uuid');
    const endpoint = `/api/v2/artist/${id}/audience/youtube`;
    const { status, body } = await this.apiGet(endpoint);
    if (status !== 200) this.throwForStatus(status, 'getYouTubeAudience');

    const items = (body as { items?: unknown } | null)?.items;
    const latest = this.pickLatest(items);
    if (!latest || typeof latest.followerCount !== 'number') {
      throw new SoundchartsApiError('Soundcharts: followerCount missing in getYouTubeAudience', status);
    }
    const observedAt = latest.date ? new Date(latest.date) : new Date();

    const subscribers: SoundchartsMetric = {
      value: latest.followerCount,
      observedAt,
      source: 'soundcharts',
      endpoint,
      field: 'items[].followerCount',
      series: this.extractSeries(items, 'followerCount'),
    };
    const videos: SoundchartsMetric | null =
      typeof latest.postCount === 'number'
        ? { value: latest.postCount, observedAt, source: 'soundcharts', endpoint, field: 'items[].postCount', series: this.extractSeries(items, 'postCount') }
        : null;
    const views: SoundchartsMetric | null =
      typeof latest.viewCount === 'number'
        ? { value: latest.viewCount, observedAt, source: 'soundcharts', endpoint, field: 'items[].viewCount', series: this.extractSeries(items, 'viewCount') }
        : null;

    return { subscribers, videos, views };
  }

  async getDeezerFans(uuid: string): Promise<SoundchartsMetric> {
    return this.getAudienceFollowerCount(uuid, 'deezer', 'getDeezerFans');
  }

  async getSoundCloudFollowers(uuid: string): Promise<SoundchartsMetric> {
    return this.getAudienceFollowerCount(uuid, 'soundcloud', 'getSoundCloudFollowers');
  }

  /**
   * Apple Music has no audience/listeners metric in Soundcharts.
   * Endpoints verified against the real API (Soundcharts 06/07), all with the
   * uuid of a known real artist:
   *   - /audience/apple-music                  → 404 "not a social platform"
   *   - /social/apple-music/followers/ (v2.37) → 404 "not a social platform"
   *   - /streaming/apple-music/listening       → 404 "not a streaming platform"
   *   - /popularity/apple-music                → 404 (the endpoint only supports
   *     Spotify/Tidal/Deezer — confirmed in the official documentation)
   *   - /charts/song/ranks/apple-music         → 200, but it is a list of
   *     positions per TRACK/country/chart, never a single ARTIST number.
   *   - /playlist/reach/apple-music            → 200. playlistReach is
   *     ALWAYS zero for apple-music (reach is only computed for
   *     Spotify/YouTube/Deezer/Jiosaavn/Boomplay, confirmed in the docs and in the
   *     real API even with Billie Eilish, 734 playlists and reach=0 in every
   *     period) — not usable. playlistCount, however, is real and non-zero:
   *     the number of Apple Music playlists that include the artist. It is not
   *     "listeners", it is editorial/playlist presence — which is why it lives only in
   *     raw_payload.playlist_count, never in the followers/subscribers/
   *     monthly_listeners fields (see AppleMusicArtistProfileProvider).
   */
  /**
   * Synchronous, network-free capability check: Soundcharts has no
   * audience metric for Apple Music (see the verified endpoints in the comment
   * above). Callers that only need to decide the card state before
   * any sync attempt use this instead of a round-trip to discover
   * the obvious (Metrics 09 phase 6).
   */
  getAppleMusicSupport(): 'NOT_SUPPORTED' {
    return 'NOT_SUPPORTED';
  }

  async getAppleMusicPlaylistCount(uuid: string): Promise<SoundchartsMetric> {
    const id = assertSafePathSegment(uuid, 'uuid');
    const endpoint = `/api/v2/artist/${id}/playlist/reach/apple-music`;
    const { status, body } = await this.apiGet(endpoint);
    if (status !== 200) this.throwForStatus(status, 'getAppleMusicPlaylistCount');

    const items = (body as { items?: unknown } | null)?.items;
    const latest = this.pickLatest(items);
    if (!latest || typeof latest.playlistCount !== 'number') {
      throw new SoundchartsNotFoundError(`Soundcharts: no playlist reach recorded in getAppleMusicPlaylistCount`, status);
    }
    return {
      value: latest.playlistCount,
      observedAt: latest.date ? new Date(latest.date) : new Date(),
      source: 'soundcharts',
      endpoint,
      field: 'items[].playlistCount',
      series: this.extractSeries(items, 'playlistCount'),
    };
  }
}
