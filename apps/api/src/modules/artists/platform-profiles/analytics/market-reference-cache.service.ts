import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../../database/database.module';
import { MarketReferenceMetricEntity } from '../../../../database/entities';
import { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import { PRIMARY_METRIC_BY_PLATFORM, type MetricKey } from '../metric-keys';
import { MAX_CANDIDATES_PER_REFRESH, COHORT_CACHE_TTL_HOURS, BENCHMARK_METRICS } from './market-benchmark.config';

export interface CohortFetchStats {
  candidatesConsidered: number;
  metricRequestCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface ReferenceCandidate {
  uuid: string;
  name: string | null;
  countryCode: string | null;
}

export interface ReferenceCandidateMetric {
  candidateUuid: string;
  metricKey: MetricKey;
  value: number | null;
}

// Metric -> Soundcharts platform, to pick the right SoundchartsService
// method (all accept a UUID directly — the candidate is external and never
// goes through registered-link resolution).
const PLATFORM_BY_METRIC = new Map<MetricKey, keyof typeof PRIMARY_METRIC_BY_PLATFORM>(
  Object.entries(PRIMARY_METRIC_BY_PLATFORM).map(([platform, metric]) => [metric, platform as keyof typeof PRIMARY_METRIC_BY_PLATFORM]),
);

/**
 * analytics/market-reference-cache.service.ts
 *
 * Phase 3.1 — discovery and caching of REAL market candidates via
 * Soundcharts `/related` (never "the tenant's artists" — that was the
 * conceptual defect fixed in this mission). Item 17 (fetch budget): the UI
 * never triggers this directly; MarketBenchmarkService calls
 * `ensureFreshCohort()` and each candidate metric is fetched again only
 * when its cache row (`market_reference_metrics`) is older than
 * COHORT_CACHE_TTL_HOURS — within the TTL the existing row is reused at
 * zero network cost. Budget per cold refresh: at most
 * MAX_CANDIDATES_PER_REFRESH candidates × (BENCHMARK_METRICS + 1 country
 * call) Soundcharts calls.
 */
@Injectable()
export class MarketReferenceCacheService {
  private readonly logger = new Logger(MarketReferenceCacheService.name);
  private readonly repo: Repository<MarketReferenceMetricEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly soundcharts: SoundchartsService,
  ) {
    if (ds) this.repo = ds.getRepository(MarketReferenceMetricEntity);
  }

  /**
   * Discovers candidates via /related and ensures each one's metric cache is
   * fresh (within the TTL) — fetching live only what is missing/stale.
   * Returns the considered candidates (up to MAX_CANDIDATES_PER_REFRESH), an
   * in-memory snapshot of the metrics (cache already updated in the
   * database) and observability statistics (item 28).
   *
   * Strictly sequential concurrency (CANDIDATE_FETCH_CONCURRENCY=1,
   * item 11) — never an unbounded `Promise.all`. A transient Soundcharts
   * error (rate limit/5xx/timeout) is PROPAGATED (it never becomes a silent
   * empty cohort — item 9): only `SoundchartsNotFoundError` (candidate
   * genuinely without that platform indexed) becomes `null`. Propagating
   * makes the refresh job (BullMQ) fail and reuse the globally configured
   * retry/backoff (attempts=3, exponential backoff) — reused, not
   * reimplemented (item 3).
   */
  async ensureFreshCohort(
    targetArtistUuid: string,
  ): Promise<{ candidates: ReferenceCandidate[]; metrics: ReferenceCandidateMetric[]; stats: CohortFetchStats }> {
    const stats: CohortFetchStats = { candidatesConsidered: 0, metricRequestCount: 0, cacheHits: 0, cacheMisses: 0 };
    if (!this.repo) return { candidates: [], metrics: [], stats };

    const related = await this.soundcharts.getRelatedArtists(targetArtistUuid, 0, 100);
    const candidateUuids = related.items.slice(0, MAX_CANDIDATES_PER_REFRESH).map((i) => i.uuid);
    if (candidateUuids.length === 0) return { candidates: [], metrics: [], stats };
    stats.candidatesConsidered = candidateUuids.length;

    const staleThreshold = new Date(Date.now() - COHORT_CACHE_TTL_HOURS * 60 * 60 * 1000);
    const existing = await this.repo
      .createQueryBuilder('m')
      .where('m.candidate_uuid IN (:...uuids)', { uuids: candidateUuids })
      .getMany();
    const existingByKey = new Map(existing.map((row) => [`${row.candidate_uuid}|${row.metric}`, row]));

    const candidates: ReferenceCandidate[] = [];
    const metrics: ReferenceCandidateMetric[] = [];

    for (const item of related.items.slice(0, MAX_CANDIDATES_PER_REFRESH)) {
      let countryCode: string | null = existing.find((r) => r.candidate_uuid === item.uuid)?.candidate_country_code ?? null;
      const needsCountryRefresh = !existing.some((r) => r.candidate_uuid === item.uuid && r.updated_at > staleThreshold);
      if (needsCountryRefresh) {
        try {
          countryCode = await this.soundcharts.getArtistCountryCode(item.uuid);
        } catch (err) {
          this.logger.warn(`[market-reference-cache] falha ao buscar país de ${item.uuid}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      candidates.push({ uuid: item.uuid, name: item.name, countryCode });

      for (const metricKey of BENCHMARK_METRICS) {
        const cacheKey = `${item.uuid}|${metricKey}`;
        const cached = existingByKey.get(cacheKey);
        const isFresh = cached && cached.updated_at > staleThreshold;
        if (isFresh) {
          stats.cacheHits += 1;
          this.logger.debug(`[market-reference-cache] benchmark_cache_hit candidate=${item.uuid} metric=${metricKey}`);
          metrics.push({ candidateUuid: item.uuid, metricKey, value: cached.value != null ? Number(cached.value) : null });
          continue;
        }

        stats.cacheMisses += 1;
        stats.metricRequestCount += 1;
        this.logger.debug(`[market-reference-cache] benchmark_cache_miss candidate=${item.uuid} metric=${metricKey}`);
        const value = await this.fetchMetric(item.uuid, metricKey);
        metrics.push({ candidateUuid: item.uuid, metricKey, value });
        await this.upsert(item.uuid, item.name, countryCode, metricKey, value);
      }
    }

    return { candidates, metrics, stats };
  }

  /** `null` = candidate genuinely without this platform indexed (SoundchartsNotFoundError). Any other error is PROPAGATED — never becomes an empty cohort (item 9). */
  private async fetchMetric(uuid: string, metricKey: MetricKey): Promise<number | null> {
    const platform = PLATFORM_BY_METRIC.get(metricKey);
    if (!platform) return null;
    try {
      switch (platform) {
        case 'spotify': return (await this.soundcharts.getSpotifyMonthlyListeners(uuid)).value;
        case 'youtube': return (await this.soundcharts.getYouTubeAudience(uuid)).subscribers.value;
        case 'deezer': return (await this.soundcharts.getDeezerFans(uuid)).value;
        case 'soundcloud': return (await this.soundcharts.getSoundCloudFollowers(uuid)).value;
        case 'instagram': return (await this.soundcharts.getInstagramFollowers(uuid)).value;
        case 'tiktok': return (await this.soundcharts.getTikTokFollowers(uuid)).value;
        case 'apple-music': return null; // no comparable audience metric — never used in BENCHMARK_METRICS today
      }
    } catch (err) {
      if (err instanceof SoundchartsNotFoundError) return null;
      throw err;
    }
  }

  private async upsert(uuid: string, name: string | null, countryCode: string | null, metricKey: MetricKey, value: number | null): Promise<void> {
    if (!this.repo) return;
    const now = new Date();
    try {
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(MarketReferenceMetricEntity)
        .values({
          candidate_uuid: uuid,
          candidate_name: name,
          candidate_country_code: countryCode,
          metric: metricKey,
          value,
          fetched_at: now,
          observed_at: now,
          source_provider: 'soundcharts',
          updated_at: now,
        } as never)
        .orUpdate(['candidate_name', 'candidate_country_code', 'value', 'fetched_at', 'observed_at', 'updated_at'], ['candidate_uuid', 'metric'])
        .execute();
    } catch (err) {
      this.logger.warn(`[market-reference-cache] falha ao gravar cache de ${uuid}/${metricKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
