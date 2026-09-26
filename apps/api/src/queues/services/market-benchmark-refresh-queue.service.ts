/**
 * queues/services/market-benchmark-refresh-queue.service.ts
 *
 * Phase 3.2 — producer service for the "analytics-refresh" queue (items 4/27:
 * no heavy Soundcharts call inside the HTTP request; the Market Benchmark
 * refresh runs in the background). Same pattern as
 * notifications-queue.service.ts: when Redis is unavailable (BullMQ
 * no-op), the methods return 'unavailable' instead of throwing — the caller
 * (MarketBenchmarkService.getStatus) decides the readStatus from that.
 *
 * Dedup (items 7/8): deterministic jobId `benchmark-refresh__{tenant}__{artist}__{engineVersion}`.
 * While a job with that id is waiting/active/delayed, a new
 * enqueue NEVER creates a duplicate job — BullMQ dedupes by jobId
 * natively. A previous 'failed' job is removed before trying again
 * (giving a clean attempt instead of being stuck on the occupied id).
 *
 * The jobId uses '__' as the separator, not ':' — BullMQ (Job.validateOptions)
 * throws "Custom Id cannot contain :" because ':' is the Redis key
 * separator. Same fix already applied in artist-external-profile-sync.service.ts.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES, ANALYTICS_REFRESH_JOB_NAMES } from '../queue.constants';
import type { MarketBenchmarkRefreshJobPayload } from '../../modules/artists/platform-profiles/analytics/market-benchmark-refresh.types';

export type EnqueueRefreshOutcome = 'enqueued' | 'already_running' | 'unavailable' | 'error';

@Injectable()
export class MarketBenchmarkRefreshQueueService {
  private readonly logger = new Logger(MarketBenchmarkRefreshQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NAMES.ANALYTICS_REFRESH)
    private readonly queue: Queue<MarketBenchmarkRefreshJobPayload> | null,
  ) {}

  get available(): boolean {
    return this.queue != null;
  }

  dedupKey(tenantId: string, artistId: string, engineVersion: string): string {
    return `benchmark-refresh__${tenantId}__${artistId}__${engineVersion}`;
  }

  async enqueueRefresh(
    tenantId: string,
    artistId: string,
    targetUuid: string,
    engineVersion: string,
    reason: MarketBenchmarkRefreshJobPayload['reason'],
  ): Promise<EnqueueRefreshOutcome> {
    if (!this.queue) return 'unavailable';
    const jobId = this.dedupKey(tenantId, artistId, engineVersion);

    try {
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state === 'waiting' || state === 'active' || state === 'delayed') {
          this.logger.debug(`[analytics-refresh] benchmark_duplicate_refresh_suppressed jobId=${jobId} state=${state}`);
          return 'already_running';
        }
        if (state === 'failed') {
          await existing.remove();
        }
      }

      const payload: MarketBenchmarkRefreshJobPayload = {
        tenant_id: tenantId,
        artist_id: artistId,
        target_uuid: targetUuid,
        engine_version: engineVersion,
        reason,
        idempotency_key: jobId,
      };
      const job = await this.queue.add(ANALYTICS_REFRESH_JOB_NAMES.MARKET_BENCHMARK_REFRESH, payload, {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`[analytics-refresh] benchmark_refresh_enqueued jobId=${job.id} tenant=${tenantId} artist=${artistId} reason=${reason}`);
      return 'enqueued';
    } catch (err) {
      this.logger.error(`[analytics-refresh] benchmark_refresh_enqueue_failed jobId=${jobId} tenant=${tenantId} artist=${artistId}: ${err instanceof Error ? err.message : String(err)}`);
      return 'error';
    }
  }

  /** 'not_found' | the job's real state — used by getStatus() to decide REFRESHING vs. re-enqueueing. */
  async getRefreshState(tenantId: string, artistId: string, engineVersion: string): Promise<string> {
    if (!this.queue) return 'not_found';
    const jobId = this.dedupKey(tenantId, artistId, engineVersion);
    const job = await this.queue.getJob(jobId);
    if (!job) return 'not_found';
    return job.getState();
  }
}
