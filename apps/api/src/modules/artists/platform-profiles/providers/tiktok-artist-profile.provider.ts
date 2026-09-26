import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  ArtistPlatformProvider,
  ArtistPlatformProviderInput,
  SocialPlatformProfileSnapshot,
} from '../social-platform-sync.types';
import { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import { checkRegisteredHandleAgainstRegistry, resolveCanonicalUuidForProvider } from '../soundcharts-canonical-candidates.util';
import { isDevMockSocialMetricsEnabled, mockFollowersFor } from '../dev-social-metrics-mock';
import { soundchartsNotIndexedProvenance, soundchartsProvenance } from '../soundcharts-provenance.util';

/**
 * Public ARTIST metric via Soundcharts /audience/tiktok — never the
 * Marketing/MusicChat OAuth connection (IntegrationsModule TikTokService,
 * a completely separate tenant-scoped integration) (Soundcharts 05).
 *
 * Phase 1.3 — PRIMARY: exact by-platform resolution of the REGISTERED handle
 * (the same identity proof spotify/youtube/deezer/soundcloud already use).
 * Falls back to the canonical UUID (spotify→youtube→deezer→soundcloud) only when the
 * handle is not indexed standalone in Soundcharts — common for
 * Instagram/TikTok — and even then uses that data only as SECONDARY, requiring
 * confirmation in the canonical entity's identifier registry (`checkRegisteredHandleAgainstRegistry`)
 * before labelling it as a verified identity; without confirmation the data is still
 * used (avoids zeroing a real audience because of a registry gap) but labelled
 * `INSUFFICIENT_EVIDENCE`, never `VERIFIED_EXACT` (fixes the conceptual inversion
 * of Phase 1.2, where the canonical entity was tried before the own handle).
 *
 * "No linked social account" (404) is a VALID Soundcharts response
 * — not every artist has TikTok indexed there (confirmed: Dj Stay 404 on
 * /identifiers, /audience/tiktok and /search/external/url; Billie Eilish
 * 200 with a real followerCount on all three) — it is not a pipeline failure. So it
 * becomes a sync success with followers=null ("Indisponível" in the UI), never
 * sync_status=failed ("Erro"), which is reserved for real failures (network,
 * 429, 5xx) (Soundcharts 07).
 */
@Injectable()
export class TikTokArtistProfileProvider implements ArtistPlatformProvider {
  readonly platform = 'tiktok' as const;

  constructor(private readonly soundcharts: SoundchartsService) {}

  async isConfigured(_tenantId?: string): Promise<boolean> {
    return this.soundcharts.isConfigured();
  }

  async resolve(input: ArtistPlatformProviderInput): Promise<SocialPlatformProfileSnapshot> {
    if (!(await this.isConfigured())) {
      throw new ServiceUnavailableException(
        'TikTok (Soundcharts) não configurado: defina SOUNDCHARTS_CLIENT_ID e SOUNDCHARTS_CLIENT_SECRET no ambiente da API',
      );
    }

    // extractUsername normalizes both a raw handle (with/without @) and a full URL —
    // always through the same normalization, whether the value comes from external_id or external_url,
    // so an "@" or formatting variation never leaks into the exact resolution.
    const username = this.extractUsername(input.externalId ?? input.externalUrl ?? '');
    if (!username) throw new Error('TikTok username missing or invalid');

    let followers: number | null = null;
    let observedAt = new Date();
    let resolvedUuid: string | null = null;
    let resolution: 'own_handle' | 'canonical' = 'own_handle';
    let primaryIdentityStatus: 'VERIFIED_EXACT' | 'INSUFFICIENT_EVIDENCE' | 'PROFILE_NOT_FOUND' = 'PROFILE_NOT_FOUND';
    let source: 'soundcharts' | 'dev_mock' = 'soundcharts';
    let provenance: ReturnType<typeof soundchartsProvenance> | ReturnType<typeof soundchartsNotIndexedProvenance> | { source_provider: 'dev_mock'; source_platform: 'tiktok'; note: string };
    const attemptedEndpoints: string[] = [];

    // PRIMARY: exact resolution by the registered handle.
    attemptedEndpoints.push(`/api/v2.9/artist/by-platform/tiktok/${username}`);
    let ownUuid: string | null = null;
    try {
      ownUuid = await this.soundcharts.resolveArtistByPlatform('tiktok', username);
    } catch (err) {
      if (!(err instanceof SoundchartsNotFoundError)) throw err;
    }

    if (ownUuid) {
      const metric = await this.soundcharts.getTikTokFollowers(ownUuid);
      followers = metric.value;
      observedAt = metric.observedAt;
      resolvedUuid = ownUuid;
      resolution = 'own_handle';
      primaryIdentityStatus = 'VERIFIED_EXACT';
      provenance = soundchartsProvenance('tiktok', metric);
    } else {
      // SECONDARY: handle not indexed standalone — tries the canonical UUID
      // (spotify/youtube/deezer/soundcloud), confirming in the registry before
      // labelling it as verified.
      const canonicalUuid = await resolveCanonicalUuidForProvider(this.soundcharts, input.canonicalUrls, 'tiktok', username);
      const registryStatus = await checkRegisteredHandleAgainstRegistry(this.soundcharts, canonicalUuid, 'tiktok', username);

      let canonicalMetric: Awaited<ReturnType<typeof this.soundcharts.getTikTokFollowers>> | null = null;
      if (registryStatus !== 'MISMATCH') {
        attemptedEndpoints.push(`/api/v2/artist/${canonicalUuid}/audience/tiktok`);
        try {
          canonicalMetric = await this.soundcharts.getTikTokFollowers(canonicalUuid);
        } catch (err) {
          if (!(err instanceof SoundchartsNotFoundError)) throw err;
        }
      }

      if (canonicalMetric) {
        followers = canonicalMetric.value;
        observedAt = canonicalMetric.observedAt;
        resolvedUuid = canonicalUuid;
        resolution = 'canonical';
        primaryIdentityStatus = registryStatus === 'CONFIRMED' ? 'VERIFIED_EXACT' : 'INSUFFICIENT_EVIDENCE';
        provenance = soundchartsProvenance('tiktok', canonicalMetric);
      } else {
        resolvedUuid = canonicalUuid;
        primaryIdentityStatus = 'PROFILE_NOT_FOUND';
        // Real "no linked social account" — in dev/local with USE_MOCK=true,
        // uses the demo fallback (never in production/staging, see
        // dev-social-metrics-mock.ts).
        if (isDevMockSocialMetricsEnabled()) {
          followers = mockFollowersFor(input.artistId, 'tiktok');
          source = 'dev_mock';
          provenance = {
            source_provider: 'dev_mock',
            source_platform: 'tiktok',
            note: 'Soundcharts confirmou conta não indexada (SOURCE_ACCOUNT_NOT_INDEXED); valor gerado deterministicamente para demonstração local, nunca em staging/production.',
          };
        } else {
          provenance = soundchartsNotIndexedProvenance('tiktok', attemptedEndpoints);
        }
      }
    }

    return {
      tenant_id: input.tenantId,
      artist_id: input.artistId,
      platform: 'tiktok',
      external_id: username,
      external_url: input.externalUrl ?? `https://www.tiktok.com/@${username}`,
      display_name: null,
      username,
      profile_url: input.externalUrl ?? `https://www.tiktok.com/@${username}`,
      image_url: null,
      followers,
      subscribers: null,
      monthly_listeners: null,
      popularity: null,
      total_views: null,
      total_videos: null,
      total_tracks: null,
      total_albums: null,
      raw_payload: {
        soundcharts_uuid: resolvedUuid,
        observed_at: observedAt.toISOString(),
        resolution,
        primary_identity_status: primaryIdentityStatus,
        source,
        ...provenance,
      },
      sync_status: 'success',
      last_synced_at: new Date(),
      last_error: null,
    };
  }

  private extractUsername(value: string): string | null {
    if (!value) return null;
    let path = value.trim();
    try {
      if (/^https?:\/\//i.test(path)) {
        const url = new URL(path);
        if (!/(^|\.)tiktok\.com$/i.test(url.hostname)) return null;
        path = url.pathname;
      }
    } catch {
      return null;
    }
    const username = path.replace(/^\/+|\/+$/g, '').split('/')[0]?.split('?')[0]?.replace(/^@/, '') ?? '';
    return /^[A-Za-z0-9._]{1,24}$/.test(username) ? username : null;
  }
}
