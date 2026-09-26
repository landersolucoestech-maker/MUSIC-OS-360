import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES, ANALYTICS_REFRESH_JOB_NAMES } from '../queue.constants';
import { MarketBenchmarkService } from '../../modules/artists/platform-profiles/analytics/market-benchmark.service';
import { DatabaseContextService } from '../../database/database-context.service';
import type { MarketBenchmarkRefreshJobPayload } from '../../modules/artists/platform-profiles/analytics/market-benchmark-refresh.types';

/**
 * queues/processors/market-benchmark-refresh.processor.ts
 *
 * Phase 3.2 — worker that performs the HEAVY work (up to
 * MAX_CANDIDATES_PER_REFRESH × BENCHMARK_METRICS Soundcharts calls) outside
 * the HTTP request. Calls MarketBenchmarkService.computeAndPersist() — the
 * same math validated in Phase 3.1, engine unchanged (item 39).
 *
 * Retry/backoff reused from BullMQ's global default (item 3) + the
 * same explicit attempts=3/exponential backoff on enqueue (item 9) — a
 * transient Soundcharts error (rate limit/5xx/timeout) propagated by
 * MarketReferenceCacheService.fetchMetric() makes this job fail and BullMQ
 * reschedules it automatically.
 *
 * Tenant context (found in the real validation with the worker): market_benchmark_snapshots
 * has FORCE RLS with WITH CHECK on private_get_tenant_id(). A BullMQ job runs outside the
 * HTTP cycle — without wrapping the call in runInTenantContext (the same pattern already used by
 * ArtistPlatformSyncProcessor), Postgres rejects the snapshot INSERT
 * ("new row violates row-level security policy"), the job still "completes" from
 * BullMQ's point of view (persistIfChanged swallows the error) and the next read never finds a
 * snapshot — re-enqueueing 'cold' indefinitely.
 */
@Processor(QUEUE_NAMES.ANALYTICS_REFRESH)
@Injectable()
export class MarketBenchmarkRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(MarketBenchmarkRefreshProcessor.name);

  constructor(
    private readonly marketBenchmark: MarketBenchmarkService,
    private readonly dbContext: DatabaseContextService,
  ) {
    super();
  }

  async process(job: Job<MarketBenchmarkRefreshJobPayload>): Promise<void> {
    if (job.name !== ANALYTICS_REFRESH_JOB_NAMES.MARKET_BENCHMARK_REFRESH) return;

    const payload = job.data;
    // Fail-closed: same pattern as ArtistPlatformSyncProcessor — an asynchronous job
    // without a tenant NEVER touches tenant-scoped data.
    if (!payload.tenant_id) {
      this.logger.warn(`[analytics-refresh] job=${job.id} sem tenant_id — abortado (fail-closed)`);
      return;
    }

    const logCtx = `job=${job.id} tenant=${payload.tenant_id} artist=${payload.artist_id} target=${payload.target_uuid} reason=${payload.reason} attempt=${job.attemptsMade + 1}`;
    const startedAt = Date.now();
    this.logger.log(`[analytics-refresh] benchmark_refresh_started ${logCtx}`);

    try {
      const { result, stats } = await this.dbContext.runInTenantContext(
        { tenantId: payload.tenant_id, orgId: null, role: null },
        () => this.marketBenchmark.computeAndPersist(payload.tenant_id, payload.artist_id, payload.target_uuid),
      );
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `[analytics-refresh] benchmark_refresh_completed ${logCtx} status=${result.status} sampleSize=${result.sampleSize} ` +
          `fallbackLevel=${result.fallbackLevel} candidateCount=${stats.candidatesConsidered} metricRequests=${stats.metricRequestCount} ` +
          `cacheHits=${stats.cacheHits} cacheMisses=${stats.cacheMisses} durationMs=${durationMs}`,
      );
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[analytics-refresh] benchmark_refresh_failed ${logCtx} durationMs=${durationMs} error="${message}"`);
      throw err; // lets BullMQ decide retry/backoff/dead-letter (removeOnFail:false keeps the job for inspection).
    }
  }
}
