import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../../database/database.module';
import { MarketBenchmarkSnapshotEntity } from '../../../../database/entities';
import { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { MarketBenchmarkRefreshQueueService } from '../../../../queues/services/market-benchmark-refresh-queue.service';
import { PRIMARY_METRIC_BY_PLATFORM, primaryMetricValue, type MetricKey } from '../metric-keys';
import { SYNC_STATUS_SUCCESS } from '../social-platform-sync.types';
import { MINIMUM_COHORT_SIZE, BENCHMARK_METRICS, BENCHMARK_SNAPSHOT_TTL_HOURS, MARKET_BENCHMARK_ENGINE_VERSION, type CohortFallbackLevel } from './market-benchmark.config';
import { MarketReferenceCacheService, type ReferenceCandidateMetric, type CohortFetchStats } from './market-reference-cache.service';
import { computeMarketBenchmark, type BenchmarkMetricInput, type MarketBenchmarkResult } from './market-benchmark.engine';

interface OwnMetricRow {
  platform: string;
  followers: number | null;
  subscribers: number | null;
  monthly_listeners: number | null;
  raw_payload: Record<string, unknown>;
}

export type MarketBenchmarkReadStatus = 'READY' | 'STALE' | 'REFRESHING' | 'INTEGRATION_UNAVAILABLE' | 'ERROR';

export interface MarketBenchmarkReadResult {
  readStatus: MarketBenchmarkReadStatus;
  /** Last known engine result (READY or STALE). null in REFRESHING/INTEGRATION_UNAVAILABLE/ERROR with no history. */
  result: MarketBenchmarkResult | null;
  /** ISO, present only when readStatus=STALE. */
  staleSince: string | null;
}

/**
 * analytics/market-benchmark.service.ts
 *
 * Phase 3.2 — read/write separation (item 26): `getStatus()` is the ONLY
 * entry point used by the controller — a fast read (local DB, no Soundcharts
 * call), it never blocks on a full refresh. `computeAndPersist()` is the
 * HEAVY work (the same math validated in Phase 3.1, engine unchanged) —
 * called ONLY by the worker (MarketBenchmarkRefreshProcessor), never by the
 * controller directly.
 *
 * Flow (item 6, stale-while-revalidate):
 *   fresh snapshot (within TTL, same engine_version) -> READY, served immediately.
 *   snapshot exists but is stale/old version -> STALE, serves the last result
 *     AND enqueues a background refresh (dedup by jobId, items 7/8).
 *   no snapshot -> REFRESHING (or INTEGRATION_UNAVAILABLE/ERROR when enqueueing
 *     is not possible), enqueues a refresh, never computes inline.
 */
@Injectable()
export class MarketBenchmarkService {
  private readonly logger = new Logger(MarketBenchmarkService.name);
  private readonly ds: DataSource | null;
  private readonly repo: Repository<MarketBenchmarkSnapshotEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly soundcharts: SoundchartsService,
    private readonly referenceCache: MarketReferenceCacheService,
    private readonly refreshQueue: MarketBenchmarkRefreshQueueService,
  ) {
    this.ds = ds;
    if (ds) this.repo = ds.getRepository(MarketBenchmarkSnapshotEntity);
  }

  // ── READ PATH (called by the controller — always fast) ─────────────────────

  async getStatus(tenantId: string, artistId: string): Promise<MarketBenchmarkReadResult> {
    if (!this.repo || !this.ds) throw new ServiceUnavailableException('Persistência indisponível');

    const ownRows = await this.queryArtistOwnMetrics(tenantId, artistId);
    const targetUuid = this.resolveTargetUuid(ownRows);

    if (!targetUuid) {
      // No Soundcharts UUID (artist never synced) — no external call is possible
      // or needed; the result is instant and honest.
      const result = computeMarketBenchmark({
        artistId,
        asOf: new Date(),
        cohortDefinition: { sourceArtistUuid: null, countryFilter: null, candidateCount: 0 },
        fallbackLevel: 2,
        cohortSize: 0,
        metrics: [],
      });
      return { readStatus: 'READY', result, staleSince: null };
    }

    const latest = await this.repo.findOne({ where: { tenant_id: tenantId, artist_id: artistId } as never, order: { calculated_at: 'DESC' } as never });
    const now = Date.now();
    const staleThreshold = now - BENCHMARK_SNAPSHOT_TTL_HOURS * 60 * 60 * 1000;
    const isFresh = latest && latest.engine_version === MARKET_BENCHMARK_ENGINE_VERSION && latest.calculated_at.getTime() > staleThreshold;

    const jobState = await this.refreshQueue.getRefreshState(tenantId, artistId, MARKET_BENCHMARK_ENGINE_VERSION);
    const refreshInFlight = jobState === 'waiting' || jobState === 'active' || jobState === 'delayed';

    if (isFresh) {
      this.logger.debug(`[market-benchmark] benchmark_snapshot_ready tenant=${tenantId} artist=${artistId}`);
      return { readStatus: 'READY', result: this.snapshotToResult(latest!), staleSince: null };
    }

    if (refreshInFlight) {
      if (latest) {
        this.logger.debug(`[market-benchmark] benchmark_stale_served tenant=${tenantId} artist=${artistId} (refresh já em andamento)`);
        return { readStatus: 'STALE', result: this.snapshotToResult(latest), staleSince: latest.calculated_at.toISOString() };
      }
      return { readStatus: 'REFRESHING', result: null, staleSince: null };
    }

    // Needs a refresh: no snapshot, stale, or engine_version changed.
    const reason = !latest ? 'cold' : 'stale';
    const outcome = await this.refreshQueue.enqueueRefresh(tenantId, artistId, targetUuid, MARKET_BENCHMARK_ENGINE_VERSION, reason);

    if (latest) {
      // stale-while-revalidate — never leaves the UI empty if a computation already happened.
      return { readStatus: 'STALE', result: this.snapshotToResult(latest), staleSince: latest.calculated_at.toISOString() };
    }
    if (outcome === 'unavailable') return { readStatus: 'INTEGRATION_UNAVAILABLE', result: null, staleSince: null };
    if (outcome === 'error') return { readStatus: 'ERROR', result: null, staleSince: null };
    return { readStatus: 'REFRESHING', result: null, staleSince: null };
  }

  // ── WRITE PATH (chamado SOMENTE pelo worker — MarketBenchmarkRefreshProcessor) ──

  async computeAndPersist(tenantId: string, artistId: string, targetUuid: string): Promise<{ result: MarketBenchmarkResult; stats: CohortFetchStats }> {
    const asOf = new Date();
    const ownRows = await this.queryArtistOwnMetrics(tenantId, artistId);

    const { candidates, metrics: candidateMetrics, stats } = await this.referenceCache.ensureFreshCohort(targetUuid);
    const targetCountryCode = await this.soundcharts.getArtistCountryCode(targetUuid).catch(() => null);

    let fallbackLevel: CohortFallbackLevel = 1;
    let pool = targetCountryCode ? candidates.filter((c) => c.countryCode === targetCountryCode) : [];
    if (pool.length < MINIMUM_COHORT_SIZE) {
      fallbackLevel = 2;
      pool = candidates;
    }
    const poolUuids = new Set(pool.map((c) => c.uuid));

    const metrics: BenchmarkMetricInput[] = BENCHMARK_METRICS.map((metricKey) =>
      this.buildMetricInput(metricKey, poolUuids, candidateMetrics, ownRows),
    );

    const result = computeMarketBenchmark({
      artistId,
      asOf,
      cohortDefinition: { sourceArtistUuid: targetUuid, countryFilter: fallbackLevel === 1 ? targetCountryCode : null, candidateCount: pool.length },
      fallbackLevel,
      cohortSize: pool.length,
      metrics,
    });

    await this.persistIfChanged(tenantId, artistId, result);
    return { result, stats };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private snapshotToResult(row: MarketBenchmarkSnapshotEntity): MarketBenchmarkResult {
    return {
      status: row.status as MarketBenchmarkResult['status'],
      score: row.score != null ? Number(row.score) : null,
      label: row.label,
      cohortDefinition: row.cohort_definition as unknown as MarketBenchmarkResult['cohortDefinition'],
      sampleSize: row.sample_size,
      fallbackLevel: row.fallback_level as CohortFallbackLevel,
      metrics: row.metrics as MarketBenchmarkResult['metrics'],
      engineVersion: row.engine_version,
      calculatedAt: row.calculated_at,
    };
  }

  /** UUID Soundcharts do artista-alvo — reaproveitado do provenance já gravado por qualquer provider Soundcharts-only bem-sucedido. */
  private resolveTargetUuid(ownRows: OwnMetricRow[]): string | null {
    for (const row of ownRows) {
      const uuid = row.raw_payload?.['soundcharts_uuid'];
      if (typeof uuid === 'string' && uuid.length > 0) return uuid;
    }
    return null;
  }

  private buildMetricInput(
    metricKey: MetricKey,
    poolUuids: Set<string>,
    candidateMetrics: ReferenceCandidateMetric[],
    ownRows: OwnMetricRow[],
  ): BenchmarkMetricInput {
    const cohortValues = candidateMetrics
      .filter((m) => m.metricKey === metricKey && poolUuids.has(m.candidateUuid) && m.value != null)
      .map((m) => m.value as number);

    const platformEntry = Object.entries(PRIMARY_METRIC_BY_PLATFORM).find(([, key]) => key === metricKey);
    const platform = platformEntry?.[0] as keyof typeof PRIMARY_METRIC_BY_PLATFORM | undefined;
    const ownRow = platform ? ownRows.find((r) => r.platform === platform) : undefined;
    const artistValue = platform && ownRow ? primaryMetricValue(platform, ownRow) : null;

    return { metricKey, artistValue, cohortValues };
  }

  private async queryArtistOwnMetrics(tenantId: string, artistId: string): Promise<OwnMetricRow[]> {
    if (!this.ds) return [];
    return this.ds.query<OwnMetricRow[]>(
      `SELECT platform, followers, subscribers, monthly_listeners, raw_payload
       FROM artist_platform_profiles
       WHERE tenant_id = $1 AND artist_id = $2 AND sync_status = $3`,
      [tenantId, artistId, SYNC_STATUS_SUCCESS],
    );
  }

  /**
   * Snapshot dedup (items 24/25): does not write a new row when the result is
   * identical to the last persisted one (same engine_version, status, score,
   * label, sampleSize, fallbackLevel) — avoids filling the table with refreshes
   * that changed nothing. Always writes when the result differs or there is no
   * previous snapshot.
   */
  private async persistIfChanged(tenantId: string, artistId: string, result: MarketBenchmarkResult): Promise<void> {
    if (!this.repo) return;
    try {
      const last = await this.repo.findOne({ where: { tenant_id: tenantId, artist_id: artistId } as never, order: { calculated_at: 'DESC' } as never });
      if (last && this.fingerprint(last) === this.fingerprintResult(result)) {
        this.logger.debug(`[market-benchmark] snapshot idêntico ao anterior — não duplicado tenant=${tenantId} artist=${artistId}`);
        return;
      }
      await this.repo.insert({
        tenant_id: tenantId,
        artist_id: artistId,
        engine_version: result.engineVersion,
        status: result.status,
        score: result.score != null ? result.score.toFixed(2) : null,
        label: result.label,
        cohort_definition: result.cohortDefinition as unknown as Record<string, unknown>,
        sample_size: result.sampleSize,
        fallback_level: result.fallbackLevel,
        metrics: result.metrics as unknown[],
        calculated_at: result.calculatedAt,
      } as never);
    } catch (err) {
      this.logger.error(`[market-benchmark] falha ao persistir snapshot (resultado OK) tenant=${tenantId} artist=${artistId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private fingerprint(row: MarketBenchmarkSnapshotEntity): string {
    return JSON.stringify([row.engine_version, row.status, row.score, row.label, row.sample_size, row.fallback_level, row.metrics]);
  }

  private fingerprintResult(result: MarketBenchmarkResult): string {
    return JSON.stringify([
      result.engineVersion,
      result.status,
      result.score != null ? result.score.toFixed(2) : null,
      result.label,
      result.sampleSize,
      result.fallbackLevel,
      result.metrics,
    ]);
  }
}
