/**
 * analytics/career-stage.engine.ts
 *
 * Phase 3 — Career Stage Engine. A pure, deterministic function: the same input
 * produces exactly the same output (item 50). It does not compute with an LLM
 * and does not hit the network — it operates entirely over already-normalized
 * Soundcharts metrics supplied by the caller (career-stage.service.ts fetches
 * the data; this file only computes).
 */
import type { MetricKey } from '../metric-keys';
import type { GrowthResult } from '../metric-growth.util';
import { normalizeAudienceSize, normalizeGrowthPercent, averageAvailable, type NormalizedScore } from './metric-normalization.util';
import {
  CAREER_STAGE_ENGINE_VERSION,
  CAREER_STAGE_DIMENSION_KEYS,
  CAREER_STAGE_WEIGHTS,
  DIMENSION_METRICS,
  GROWTH_ELIGIBLE_METRICS,
  AUDIENCE_CEILINGS,
  GROWTH_POSITIVE_CEILING,
  GROWTH_NEGATIVE_FLOOR,
  CAREER_STAGE_COVERAGE_GATE,
  CAREER_STAGE_CLASSIFICATION,
  EXPLAINABILITY_THRESHOLDS,
  STALE_AFTER_DAYS,
  type CareerStageDimensionKey,
} from './career-stage.config';

export interface CareerStageMetricPoint {
  metricKey: MetricKey;
  currentValue: number | null;
  observedAt: Date | null;
  /** null when the metric is not eligible for growth or there is not enough history. */
  growth30d: GrowthResult | null;
  growth90d: GrowthResult | null;
}

export interface CareerStageEngineInput {
  artistId: string;
  asOf: Date;
  metrics: CareerStageMetricPoint[];
  /** Number of distinct platforms (of the 7 supported) with at least one real current value. */
  platformsWithData: number;
  /** Most recent observedAt across every metric — null when there is none. */
  mostRecentObservedAt: Date | null;
  /** Days between the oldest and the most recent available history point — null without history. */
  historyDepthDays: number | null;
}

export interface CareerStageDimensionResult {
  key: CareerStageDimensionKey;
  weight: number;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  score: number | null;
  metricsUsed: MetricKey[];
  evidence: Array<{ metricKey: MetricKey; rawValue: number | null; normalizedScore: number | null }>;
}

export interface CareerStageExplainabilityItem {
  dimension: CareerStageDimensionKey;
  reason: string;
  metrics: MetricKey[];
  evidence: Array<{ metricKey: MetricKey; rawValue: number | null }>;
}

export type CareerStageStatus = 'OK' | 'INSUFFICIENT_DATA';

export interface CareerStageResult {
  status: CareerStageStatus;
  /** 0.0-10.0, null when status=INSUFFICIENT_DATA. */
  score: number | null;
  classification: string | null;
  /** 0-100. */
  confidence: number;
  /** 0-1: fraction of the total weight covered by available dimensions. */
  coverage: number;
  dimensions: CareerStageDimensionResult[];
  positiveFactors: CareerStageExplainabilityItem[];
  bottlenecks: CareerStageExplainabilityItem[];
  engineVersion: string;
  calculatedAt: Date;
  freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
}

function classify(score: number): string {
  const band = CAREER_STAGE_CLASSIFICATION.find((b) => score >= b.min && score <= b.max);
  return band?.label ?? CAREER_STAGE_CLASSIFICATION[CAREER_STAGE_CLASSIFICATION.length - 1].label;
}

function computeSizeDimension(
  key: 'AUDIENCE' | 'STREAMING' | 'SOCIAL' | 'MARKET_PRESENCE',
  input: CareerStageEngineInput,
): CareerStageDimensionResult {
  const metricKeys = DIMENSION_METRICS[key];
  const evidence: CareerStageDimensionResult['evidence'] = [];
  const scores: NormalizedScore[] = [];
  const metricsUsed: MetricKey[] = [];

  for (const metricKey of metricKeys) {
    const point = input.metrics.find((m) => m.metricKey === metricKey);
    const normalized = normalizeAudienceSize(point?.currentValue ?? null, AUDIENCE_CEILINGS[metricKey]);
    evidence.push({ metricKey, rawValue: point?.currentValue ?? null, normalizedScore: normalized.score });
    if (normalized.score != null) {
      scores.push(normalized);
      metricsUsed.push(metricKey);
    }
  }

  const score = averageAvailable(scores);
  return {
    key,
    weight: CAREER_STAGE_WEIGHTS[key],
    status: score != null ? 'AVAILABLE' : 'UNAVAILABLE',
    score,
    metricsUsed,
    evidence,
  };
}

function computeGrowthDimension(
  key: 'GROWTH' | 'MOMENTUM',
  window: 'growth30d' | 'growth90d',
  input: CareerStageEngineInput,
): CareerStageDimensionResult {
  const evidence: CareerStageDimensionResult['evidence'] = [];
  const scores: NormalizedScore[] = [];
  const metricsUsed: MetricKey[] = [];

  for (const metricKey of GROWTH_ELIGIBLE_METRICS) {
    const point = input.metrics.find((m) => m.metricKey === metricKey);
    const growth = point?.[window] ?? null;
    const pct = growth?.status === 'OK' ? growth.percentageChange : null;
    const normalized = normalizeGrowthPercent(pct, GROWTH_POSITIVE_CEILING, GROWTH_NEGATIVE_FLOOR);
    evidence.push({ metricKey, rawValue: pct, normalizedScore: normalized.score });
    if (normalized.score != null) {
      scores.push(normalized);
      metricsUsed.push(metricKey);
    }
  }

  const score = averageAvailable(scores);
  return {
    key,
    weight: CAREER_STAGE_WEIGHTS[key],
    status: score != null ? 'AVAILABLE' : 'UNAVAILABLE',
    score,
    metricsUsed,
    evidence,
  };
}

function computeDimension(key: CareerStageDimensionKey, input: CareerStageEngineInput): CareerStageDimensionResult {
  switch (key) {
    case 'AUDIENCE': case 'STREAMING': case 'SOCIAL': case 'MARKET_PRESENCE':
      return computeSizeDimension(key, input);
    case 'GROWTH':
      return computeGrowthDimension('GROWTH', 'growth30d', input);
    case 'MOMENTUM':
      return computeGrowthDimension('MOMENTUM', 'growth90d', input);
  }
}

function reasonFor(dim: CareerStageDimensionResult, kind: 'positive' | 'bottleneck'): string {
  const labels: Record<CareerStageDimensionKey, string> = {
    AUDIENCE: 'audiência combinada entre plataformas',
    STREAMING: 'ouvintes mensais no Spotify',
    SOCIAL: 'seguidores em Instagram/TikTok',
    MARKET_PRESENCE: 'presença editorial (playlists Apple Music)',
    GROWTH: 'crescimento de curto prazo (30 dias)',
    MOMENTUM: 'crescimento de médio prazo (90 dias)',
  };
  const verb = kind === 'positive' ? 'é um ponto forte' : 'é um gargalo';
  return `${labels[dim.key]} ${verb} (score ${dim.score?.toFixed(0)}/100, peso ${dim.weight}%).`;
}

function confidenceScore(
  coverage: number,
  platformsWithData: number,
  mostRecentObservedAt: Date | null,
  historyDepthDays: number | null,
  asOf: Date,
): number {
  const coverageRatio = Math.max(0, Math.min(1, coverage));
  const platformRatio = Math.max(0, Math.min(1, platformsWithData / 7));
  let freshnessRatio = 0;
  if (mostRecentObservedAt) {
    const daysSince = (asOf.getTime() - mostRecentObservedAt.getTime()) / (24 * 60 * 60 * 1000);
    freshnessRatio = daysSince <= STALE_AFTER_DAYS ? 1 : Math.max(0, 1 - (daysSince - STALE_AFTER_DAYS) / STALE_AFTER_DAYS);
  }
  const historyRatio = historyDepthDays != null ? Math.max(0, Math.min(1, historyDepthDays / 365)) : 0;
  const raw = 100 * (0.4 * coverageRatio + 0.25 * platformRatio + 0.2 * freshnessRatio + 0.15 * historyRatio);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function computeCareerStage(input: CareerStageEngineInput): CareerStageResult {
  const dimensions = CAREER_STAGE_DIMENSION_KEYS.map((key) => computeDimension(key, input));
  const available = dimensions.filter((d) => d.score != null);
  const availableWeight = available.reduce((acc, d) => acc + d.weight, 0);
  const coverage = availableWeight / 100;

  const confidence = confidenceScore(coverage, input.platformsWithData, input.mostRecentObservedAt, input.historyDepthDays, input.asOf);

  const meetsGate =
    available.length >= CAREER_STAGE_COVERAGE_GATE.minimumAvailableDimensions &&
    coverage >= CAREER_STAGE_COVERAGE_GATE.minimumCoverageWeight;

  let status: CareerStageStatus = 'INSUFFICIENT_DATA';
  let score: number | null = null;
  let classification: string | null = null;

  if (meetsGate) {
    // Renormalization (item 13): unavailable dimensions never penalize as zero —
    // the denominator is the sum of AVAILABLE weights, not 100.
    const weightedSum = available.reduce((acc, d) => acc + (d.score as number) * d.weight, 0);
    const score0to100 = weightedSum / availableWeight;
    score = Math.round((score0to100 / 10) * 10) / 10; // 0-10, 1 decimal place
    classification = classify(score);
    status = 'OK';
  }

  const positiveFactors: CareerStageExplainabilityItem[] = [];
  const bottlenecks: CareerStageExplainabilityItem[] = [];
  for (const dim of available) {
    if ((dim.score as number) >= EXPLAINABILITY_THRESHOLDS.positive) {
      positiveFactors.push({
        dimension: dim.key,
        reason: reasonFor(dim, 'positive'),
        metrics: dim.metricsUsed,
        evidence: dim.evidence.map((e) => ({ metricKey: e.metricKey, rawValue: e.rawValue })),
      });
    } else if ((dim.score as number) <= EXPLAINABILITY_THRESHOLDS.bottleneck) {
      bottlenecks.push({
        dimension: dim.key,
        reason: reasonFor(dim, 'bottleneck'),
        metrics: dim.metricsUsed,
        evidence: dim.evidence.map((e) => ({ metricKey: e.metricKey, rawValue: e.rawValue })),
      });
    }
  }

  const freshness: CareerStageResult['freshness'] = !input.mostRecentObservedAt
    ? 'UNKNOWN'
    : (input.asOf.getTime() - input.mostRecentObservedAt.getTime()) / (24 * 60 * 60 * 1000) <= STALE_AFTER_DAYS
      ? 'FRESH'
      : 'STALE';

  return {
    status,
    score,
    classification,
    confidence,
    coverage,
    dimensions,
    positiveFactors,
    bottlenecks,
    engineVersion: CAREER_STAGE_ENGINE_VERSION,
    calculatedAt: input.asOf,
    freshness,
  };
}
