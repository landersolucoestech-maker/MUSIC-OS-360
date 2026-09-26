/**
 * analytics/market-benchmark.engine.ts
 *
 * Phase 3.1 — Market Benchmark Engine (relative/cohort-based — see
 * career-stage.config.ts for the formal distinction from Career Stage, which is
 * absolute/model-based). A pure, deterministic function — the caller
 * (market-benchmark.service.ts) builds the cohort from REAL EXTERNAL CANDIDATES
 * (Soundcharts /related + their own metrics, never "other artists of the
 * tenant" — that was the conceptual defect fixed in this mission). This file
 * only computes median/percentile and never hits the network.
 */
import type { MetricKey } from '../metric-keys';
import { median, percentileRank } from './metric-normalization.util';
import {
  MARKET_BENCHMARK_ENGINE_VERSION,
  MINIMUM_COHORT_SIZE,
  HIGH_QUALITY_SAMPLE_SIZE,
  BENCHMARK_METRICS,
  BENCHMARK_LABELS,
  type CohortFallbackLevel,
} from './market-benchmark.config';

export interface BenchmarkMetricInput {
  metricKey: MetricKey;
  /** null when the artist itself has no real value for this metric. */
  artistValue: number | null;
  /** Real values of external candidates (never includes the artist itself, never tenant artists). */
  cohortValues: number[];
}

export interface CohortDefinition {
  /** UUID Soundcharts do artista-alvo — origem da descoberta /related. */
  sourceArtistUuid: string | null;
  /** country_code applied as a filter, or null when unfiltered (L2/L3). */
  countryFilter: string | null;
  /** Number of external candidates considered (before filtering by available metric). */
  candidateCount: number;
}

export interface MarketBenchmarkEngineInput {
  artistId: string;
  asOf: Date;
  cohortDefinition: CohortDefinition;
  fallbackLevel: CohortFallbackLevel;
  /** Number of distinct external candidates considered (independent of per-metric coverage). */
  cohortSize: number;
  metrics: BenchmarkMetricInput[];
}

export type BenchmarkMetricStatus = 'AVAILABLE' | 'ARTIST_VALUE_UNAVAILABLE' | 'INSUFFICIENT_COHORT';

/**
 * Sample quality indicator PER METRIC (item 16) — deliberately based only on
 * sampleSize (the most direct, defensible driver of a percentile's reliability:
 * a proportion's standard error scales with 1/√n), instead of a composite formula
 * with invented weights.
 * HIGH: n >= HIGH_QUALITY_SAMPLE_SIZE (30 — the classic normal-approximation
 * threshold). MEDIUM: MINIMUM_COHORT_SIZE <= n < 30. INSUFFICIENT: n < minimum
 * (metric.status is already INSUFFICIENT_COHORT in that case).
 */
export type SampleQuality = 'HIGH' | 'MEDIUM' | 'INSUFFICIENT';

function sampleQualityFor(sampleSize: number): SampleQuality {
  if (sampleSize >= HIGH_QUALITY_SAMPLE_SIZE) return 'HIGH';
  if (sampleSize >= MINIMUM_COHORT_SIZE) return 'MEDIUM';
  return 'INSUFFICIENT';
}

export interface BenchmarkMetricResult {
  metricKey: MetricKey;
  status: BenchmarkMetricStatus;
  artistValue: number | null;
  cohortMedian: number | null;
  percentile: number | null;
  /** THIS metric's specific sample — not every candidate has every metric (item 20). */
  sampleSize: number;
  sampleQuality: SampleQuality;
  source: 'soundcharts';
}

export type MarketBenchmarkStatus = 'OK' | 'INSUFFICIENT_MARKET_DATA';

export interface MarketBenchmarkResult {
  status: MarketBenchmarkStatus;
  /** 0-100, the mean of the available percentiles. null when status=INSUFFICIENT_MARKET_DATA. */
  score: number | null;
  label: string | null;
  cohortDefinition: CohortDefinition;
  sampleSize: number;
  fallbackLevel: CohortFallbackLevel;
  metrics: BenchmarkMetricResult[];
  engineVersion: string;
  calculatedAt: Date;
}

function labelFor(score: number): string {
  const band = BENCHMARK_LABELS.find((b) => score >= b.min && score <= b.max);
  return band?.label ?? BENCHMARK_LABELS[BENCHMARK_LABELS.length - 1].label;
}

function computeMetric(input: BenchmarkMetricInput): BenchmarkMetricResult {
  const sampleSize = input.cohortValues.length;
  const sampleQuality = sampleQualityFor(sampleSize);
  if (sampleSize < MINIMUM_COHORT_SIZE) {
    return {
      metricKey: input.metricKey,
      status: 'INSUFFICIENT_COHORT',
      artistValue: input.artistValue,
      cohortMedian: median(input.cohortValues),
      percentile: null,
      sampleSize,
      sampleQuality,
      source: 'soundcharts',
    };
  }
  if (input.artistValue == null) {
    return {
      metricKey: input.metricKey,
      status: 'ARTIST_VALUE_UNAVAILABLE',
      artistValue: null,
      cohortMedian: median(input.cohortValues),
      percentile: null,
      sampleSize,
      sampleQuality,
      source: 'soundcharts',
    };
  }
  return {
    metricKey: input.metricKey,
    status: 'AVAILABLE',
    artistValue: input.artistValue,
    cohortMedian: median(input.cohortValues),
    // item 19: the percentile is ALWAYS over the raw metric value — never over a
    // score already normalized by Career Stage.
    percentile: percentileRank(input.cohortValues, input.artistValue),
    sampleSize,
    sampleQuality,
    source: 'soundcharts',
  };
}

export function computeMarketBenchmark(input: MarketBenchmarkEngineInput): MarketBenchmarkResult {
  const metrics = BENCHMARK_METRICS.map((metricKey) => {
    const found = input.metrics.find((m) => m.metricKey === metricKey);
    return computeMetric(found ?? { metricKey, artistValue: null, cohortValues: [] });
  });

  const availablePercentiles = metrics
    .filter((m): m is BenchmarkMetricResult & { percentile: number } => m.status === 'AVAILABLE' && m.percentile != null)
    .map((m) => m.percentile);

  const status: MarketBenchmarkStatus = availablePercentiles.length > 0 ? 'OK' : 'INSUFFICIENT_MARKET_DATA';
  const score = status === 'OK' ? availablePercentiles.reduce((a, b) => a + b, 0) / availablePercentiles.length : null;

  return {
    status,
    score,
    label: score != null ? labelFor(score) : null,
    cohortDefinition: input.cohortDefinition,
    sampleSize: input.cohortSize,
    fallbackLevel: input.fallbackLevel,
    metrics,
    engineVersion: MARKET_BENCHMARK_ENGINE_VERSION,
    calculatedAt: input.asOf,
  };
}
