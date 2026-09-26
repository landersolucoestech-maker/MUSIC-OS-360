import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../../database/database.module';
import { CareerStageSnapshotEntity } from '../../../../database/entities';
import { ArtistPlatformProfilesService } from '../artist-platform-profiles.service';
import { ArtistMetricSnapshotsService } from '../artist-metric-snapshots.service';
import { PRIMARY_METRIC_BY_PLATFORM, primaryMetricValue } from '../metric-keys';
import { SYNC_STATUS_SUCCESS } from '../social-platform-sync.types';
import { GROWTH_ELIGIBLE_METRICS } from './career-stage.config';
import { computeCareerStage, type CareerStageEngineInput, type CareerStageMetricPoint, type CareerStageResult } from './career-stage.engine';

/**
 * analytics/career-stage.service.ts
 *
 * Orchestrates the Career Stage Engine (a pure function in
 * career-stage.engine.ts) with ALREADY-INGESTED data (item 58: it never queries
 * Soundcharts live here) — current state via ArtistPlatformProfilesService and
 * history/growth via ArtistMetricSnapshotsService, both existing from Phase 2.
 * Persists each computation as a new row in career_stage_snapshots
 * (append-only, item 38).
 */
@Injectable()
export class CareerStageService {
  private readonly logger = new Logger(CareerStageService.name);
  private readonly repo: Repository<CareerStageSnapshotEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly profiles: ArtistPlatformProfilesService,
    private readonly snapshots: ArtistMetricSnapshotsService,
  ) {
    if (ds) this.repo = ds.getRepository(CareerStageSnapshotEntity);
  }

  async calculate(tenantId: string, artistId: string): Promise<CareerStageResult> {
    const asOf = new Date();
    const profileRows = await this.profiles.findByArtist(tenantId, artistId);
    const successRows = profileRows.filter((p) => p.sync_status === SYNC_STATUS_SUCCESS);

    const metricPoints: CareerStageMetricPoint[] = [];
    let platformsWithData = 0;
    let mostRecentObservedAt: Date | null = null;
    let oldestObservedAt: Date | null = null;

    for (const [platform, metricKey] of Object.entries(PRIMARY_METRIC_BY_PLATFORM)) {
      const row = successRows.find((p) => p.platform === platform);
      const currentValue = row ? primaryMetricValue(platform as keyof typeof PRIMARY_METRIC_BY_PLATFORM, row) : null;
      if (currentValue != null) platformsWithData += 1;
      if (row?.last_synced_at && (!mostRecentObservedAt || row.last_synced_at > mostRecentObservedAt)) {
        mostRecentObservedAt = row.last_synced_at;
      }

      let growth30d = null;
      let growth90d = null;
      if (GROWTH_ELIGIBLE_METRICS.includes(metricKey)) {
        const history = await this.snapshots.history({ tenantId, artistId, platform, metric: metricKey });
        if (history.length > 0) {
          const oldest = history[0].observedAt;
          const newest = history[history.length - 1].observedAt;
          if (!oldestObservedAt || oldest < oldestObservedAt) oldestObservedAt = oldest;
          if (!mostRecentObservedAt || newest > mostRecentObservedAt) mostRecentObservedAt = newest;
        }
        [growth30d, growth90d] = await Promise.all([
          this.snapshots.growth({ tenantId, artistId, platform, metric: metricKey, periodDays: 30, asOf }),
          this.snapshots.growth({ tenantId, artistId, platform, metric: metricKey, periodDays: 90, asOf }),
        ]);
      }

      metricPoints.push({
        metricKey,
        currentValue,
        observedAt: row?.last_synced_at ?? null,
        growth30d,
        growth90d,
      });
    }

    const historyDepthDays = oldestObservedAt && mostRecentObservedAt
      ? Math.max(0, (mostRecentObservedAt.getTime() - oldestObservedAt.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    const input: CareerStageEngineInput = {
      artistId,
      asOf,
      metrics: metricPoints,
      platformsWithData,
      mostRecentObservedAt,
      historyDepthDays,
    };

    const result = computeCareerStage(input);
    await this.persist(tenantId, artistId, result, metricPoints);
    return result;
  }

  /**
   * Phase 3.2, items 25/26: GET is a read and must not fill the table with
   * identical results on every screen opening. `calculate()` still computes
   * every time (cheap — only already-ingested reads, no Soundcharts call), but
   * only WRITES a new row when the result really differs from the last snapshot
   * (same engine_version, status, score, classification, confidence, coverage
   * and dimensions).
   */
  private async persist(
    tenantId: string,
    artistId: string,
    result: CareerStageResult,
    metricPoints: CareerStageMetricPoint[],
  ): Promise<void> {
    if (!this.repo) return;
    try {
      const last = await this.repo.findOne({ where: { tenant_id: tenantId, artist_id: artistId } as never, order: { calculated_at: 'DESC' } as never });
      if (last && this.fingerprint(last) === this.fingerprintResult(result)) {
        this.logger.debug(`[career-stage] snapshot idêntico ao anterior — não duplicado tenant=${tenantId} artist=${artistId}`);
        return;
      }
      await this.repo.insert({
        tenant_id: tenantId,
        artist_id: artistId,
        engine_version: result.engineVersion,
        status: result.status,
        score: result.score != null ? result.score.toFixed(1) : null,
        classification: result.classification,
        confidence: result.confidence,
        coverage: result.coverage.toFixed(3),
        dimensions: result.dimensions as unknown[],
        positive_factors: result.positiveFactors as unknown[],
        bottlenecks: result.bottlenecks as unknown[],
        input_provenance: metricPoints.map((m) => ({ metricKey: m.metricKey, currentValue: m.currentValue, observedAt: m.observedAt?.toISOString() ?? null })),
        calculated_at: result.calculatedAt,
      } as never);
    } catch (err) {
      // Append-only audit trail — never breaks the user response if the write fails
      // (same pattern as ArtistMetricSnapshotsService).
      this.logger.error(`[career-stage] falha ao persistir snapshot (resultado OK) tenant=${tenantId} artist=${artistId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private fingerprint(row: CareerStageSnapshotEntity): string {
    return JSON.stringify([row.engine_version, row.status, row.score, row.classification, row.confidence, row.coverage, row.dimensions]);
  }

  private fingerprintResult(result: CareerStageResult): string {
    return JSON.stringify([
      result.engineVersion,
      result.status,
      result.score != null ? result.score.toFixed(1) : null,
      result.classification,
      result.confidence,
      result.coverage.toFixed(3),
      result.dimensions,
    ]);
  }
}
