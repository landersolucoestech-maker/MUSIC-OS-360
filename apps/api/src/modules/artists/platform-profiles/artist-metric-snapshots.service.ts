import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { ArtistMetricSnapshotEntity } from '../../../database/entities';
import type { SocialPlatformProfileSnapshot } from './social-platform-sync.types';
import { METRIC_KEYS, METRIC_UNIT, type MetricKey } from './metric-keys';
import { computeGrowth, type GrowthPoint, type GrowthResult } from './metric-growth.util';

interface SeriesPoint {
  value: number;
  observed_at: string;
}

interface CandidatePoint {
  metric: MetricKey;
  value: number;
  observedAt: Date;
  sourceProvider: string;
}

function asSeries(value: unknown): SeriesPoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (p): p is SeriesPoint => !!p && typeof p === 'object' && typeof (p as SeriesPoint).value === 'number' && typeof (p as SeriesPoint).observed_at === 'string',
  );
}

/**
 * Extracts the historical-snapshot candidate points from a
 * SocialPlatformProfileSnapshot already persisted successfully by the provider.
 * Prefers the full series (raw_payload.metric_series, or the nested YouTube
 * equivalent) when present — a real backfill with no extra API call
 * (Phase 2, item 11). Without a series, falls back to the single point of
 * the current sync. NEVER invents a point: a missing/null metric is
 * omitted, never turned into 0 (item 9).
 */
function candidatesFor(snapshot: SocialPlatformProfileSnapshot): CandidatePoint[] {
  const rp = snapshot.raw_payload ?? {};
  const scalarObservedAt = typeof rp['observed_at'] === 'string' ? new Date(rp['observed_at'] as string) : null;
  const topSeries = asSeries(rp['metric_series']);
  const out: CandidatePoint[] = [];

  const pushSeriesOrScalar = (metric: MetricKey, series: SeriesPoint[], scalarValue: number | null, sourceProvider: string) => {
    if (series.length > 0) {
      for (const p of series) out.push({ metric, value: p.value, observedAt: new Date(p.observed_at), sourceProvider });
    } else if (scalarValue != null && Number.isFinite(scalarValue) && scalarObservedAt) {
      out.push({ metric, value: scalarValue, observedAt: scalarObservedAt, sourceProvider });
    }
  };

  switch (snapshot.platform) {
    case 'spotify':
      pushSeriesOrScalar(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, topSeries, snapshot.monthly_listeners, 'soundcharts');
      break;
    case 'deezer':
      pushSeriesOrScalar(METRIC_KEYS.DEEZER_FANS, topSeries, snapshot.followers, 'soundcharts');
      break;
    case 'soundcloud':
      pushSeriesOrScalar(METRIC_KEYS.SOUNDCLOUD_FOLLOWERS, topSeries, snapshot.followers, 'soundcharts');
      break;
    case 'instagram':
      pushSeriesOrScalar(METRIC_KEYS.INSTAGRAM_FOLLOWERS, topSeries, snapshot.followers, 'soundcharts');
      break;
    case 'tiktok':
      pushSeriesOrScalar(METRIC_KEYS.TIKTOK_FOLLOWERS, topSeries, snapshot.followers, 'soundcharts');
      break;
    case 'apple-music': {
      const playlistCount = typeof rp['playlist_count'] === 'number' ? (rp['playlist_count'] as number) : null;
      pushSeriesOrScalar(METRIC_KEYS.APPLE_MUSIC_PLAYLIST_COUNT, topSeries, playlistCount, 'soundcharts');
      break;
    }
    case 'youtube': {
      // subscribers comes from Soundcharts, nested in subscribers_provenance
      // (see YouTubeArtistProfileProvider) — its own series, not the top-level one.
      const subsProvenance = rp['subscribers_provenance'] as Record<string, unknown> | undefined;
      const subsSeries = asSeries(subsProvenance?.['metric_series']);
      pushSeriesOrScalar(METRIC_KEYS.YOUTUBE_SUBSCRIBERS, subsSeries, snapshot.subscribers, 'soundcharts');

      // total_views/total_videos come from the SAME Soundcharts call as
      // subscribers (2026-08-31 audit — SOUNDCHARTS ONLY rule, see
      // YouTubeArtistProfileProvider). source_provider is read from
      // views_videos_provenance instead of being fixed: never hardcode
      // 'youtube_data_api' here, at the risk of labelling Soundcharts data as
      // coming from another source as soon as the provider changes.
      const viewsProvenance = rp['views_videos_provenance'] as Record<string, unknown> | null | undefined;
      const viewsSourceProvider = typeof viewsProvenance?.['source_provider'] === 'string' ? (viewsProvenance['source_provider'] as string) : 'soundcharts';
      const viewsFetchedAt =
        viewsProvenance && typeof viewsProvenance['fetched_at'] === 'string' ? new Date(viewsProvenance['fetched_at'] as string) : scalarObservedAt;
      const totalViews = snapshot.total_views != null ? Number(snapshot.total_views) : null;
      if (totalViews != null && Number.isFinite(totalViews) && viewsFetchedAt) {
        out.push({ metric: METRIC_KEYS.YOUTUBE_VIEWS, value: totalViews, observedAt: viewsFetchedAt, sourceProvider: viewsSourceProvider });
      }
      if (snapshot.total_videos != null && viewsFetchedAt) {
        out.push({ metric: METRIC_KEYS.YOUTUBE_VIDEOS, value: snapshot.total_videos, observedAt: viewsFetchedAt, sourceProvider: viewsSourceProvider });
      }
      break;
    }
  }
  return out;
}

@Injectable()
export class ArtistMetricSnapshotsService {
  private readonly logger = new Logger(ArtistMetricSnapshotsService.name);
  private readonly repo: Repository<ArtistMetricSnapshotEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(ArtistMetricSnapshotEntity);
  }

  private requireRepo(): Repository<ArtistMetricSnapshotEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Artist metric snapshot persistence unavailable');
    return this.repo;
  }

  /**
   * Writes the real historical points extracted from a successful sync
   * snapshot. Never called for sync_status != 'success', and never for
   * dev_mock snapshots (audit/history must not contain fabricated data,
   * even when labelled — "DO NOT INVENT DATA" item). Idempotent by
   * design: ON CONFLICT DO NOTHING on the key (tenant_id, artist_id, platform,
   * metric, observed_at) — a retry or double click never duplicates a
   * logically equal point.
   */
  async recordFromProfileSnapshot(snapshot: SocialPlatformProfileSnapshot): Promise<{ inserted: number; skipped: number }> {
    if (snapshot.sync_status !== 'success') return { inserted: 0, skipped: 0 };
    const rp = snapshot.raw_payload ?? {};
    if (rp['source'] === 'dev_mock') return { inserted: 0, skipped: 0 };

    const candidates = candidatesFor(snapshot);
    if (candidates.length === 0) return { inserted: 0, skipped: 0 };

    const registeredIdentifier = snapshot.username ?? snapshot.external_id ?? null;
    const providerEntityId = typeof rp['soundcharts_uuid'] === 'string' ? (rp['soundcharts_uuid'] as string) : null;
    const primaryIdentityStatus = typeof rp['primary_identity_status'] === 'string' ? (rp['primary_identity_status'] as string) : null;
    const crossPlatformStatus = typeof rp['cross_platform_status'] === 'string' ? (rp['cross_platform_status'] as string) : null;
    const now = new Date();

    const rows = candidates.map((c) => ({
      tenant_id: snapshot.tenant_id,
      artist_id: snapshot.artist_id,
      platform: snapshot.platform,
      metric: c.metric,
      value: c.value,
      unit: METRIC_UNIT[c.metric],
      source_provider: c.sourceProvider,
      registered_identifier: registeredIdentifier,
      provider_entity_id: providerEntityId,
      primary_identity_status: primaryIdentityStatus,
      cross_platform_status: crossPlatformStatus,
      observed_at: c.observedAt,
      fetched_at: now,
      recorded_at: now,
      normalizer_version: 1,
      raw_payload: {},
    }));

    const result = await this.requireRepo()
      .createQueryBuilder()
      .insert()
      .into(ArtistMetricSnapshotEntity)
      .values(rows as never)
      .orIgnore()
      .execute();

    const inserted = result.identifiers.filter((id) => id && Object.keys(id).length > 0).length;
    const skipped = rows.length - inserted;
    if (inserted > 0) {
      this.logger.log(`[metric-snapshot] persisted count=${inserted} deduplicated=${skipped} tenant=${snapshot.tenant_id} artist=${snapshot.artist_id} platform=${snapshot.platform}`);
    } else if (skipped > 0) {
      this.logger.debug(`[metric-snapshot] deduplicated count=${skipped} tenant=${snapshot.tenant_id} artist=${snapshot.artist_id} platform=${snapshot.platform}`);
    }
    return { inserted, skipped };
  }

  /** Raw historical read — tenant-scoped, ordered by ascending observed_at. */
  async history(input: {
    tenantId: string;
    artistId: string;
    platform: string;
    metric: MetricKey;
    from?: Date;
    to?: Date;
  }): Promise<GrowthPoint[]> {
    const qb = this.requireRepo()
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId: input.tenantId })
      .andWhere('s.artist_id = :artistId', { artistId: input.artistId })
      .andWhere('s.platform = :platform', { platform: input.platform })
      .andWhere('s.metric = :metric', { metric: input.metric })
      .orderBy('s.observed_at', 'ASC');
    if (input.from) qb.andWhere('s.observed_at >= :from', { from: input.from });
    if (input.to) qb.andWhere('s.observed_at <= :to', { to: input.to });

    const rows = await qb.getMany();
    return rows.map((r) => ({ value: Number(r.value), observedAt: r.observed_at }));
  }

  /** Deterministic growth (Phase 2 — no Momentum classification) for a period in days. */
  async growth(input: { tenantId: string; artistId: string; platform: string; metric: MetricKey; periodDays: number; asOf?: Date }): Promise<GrowthResult> {
    const asOf = input.asOf ?? new Date();
    const points = await this.history({
      tenantId: input.tenantId,
      artistId: input.artistId,
      platform: input.platform,
      metric: input.metric,
      to: asOf,
    });
    return computeGrowth(points, input.periodDays, asOf);
  }
}
