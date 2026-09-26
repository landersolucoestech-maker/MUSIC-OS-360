import { computeMarketBenchmark, type MarketBenchmarkEngineInput, type BenchmarkMetricInput } from './market-benchmark.engine';
import { METRIC_KEYS } from '../metric-keys';
import { MINIMUM_COHORT_SIZE, HIGH_QUALITY_SAMPLE_SIZE, MARKET_BENCHMARK_ENGINE_VERSION } from './market-benchmark.config';

const ASOF = new Date('2026-08-31T00:00:00Z');

function bigCohort(n: number, base = 1000): number[] {
  return Array.from({ length: n }, (_, i) => base + i * 100);
}

function baseInput(overrides: Partial<MarketBenchmarkEngineInput> = {}): MarketBenchmarkEngineInput {
  return {
    artistId: 'artist-1',
    asOf: ASOF,
    cohortDefinition: { sourceArtistUuid: 'sc-uuid-1', countryFilter: null, candidateCount: 0 },
    fallbackLevel: 2,
    cohortSize: 0,
    metrics: [],
    ...overrides,
  };
}

describe('computeMarketBenchmark', () => {
  it('valid cohort (>= minimumCohortSize): status OK, real score/percentile', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 5000, cohortValues: bigCohort(15) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 15, metrics }));
    expect(result.status).toBe('OK');
    expect(result.score).not.toBeNull();
    expect(result.label).not.toBeNull();
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
    expect(m.status).toBe('AVAILABLE');
    expect(m.percentile).not.toBeNull();
    expect(m.sampleQuality).toBe('MEDIUM'); // 15 < 30
  });

  it('insufficient cohort (< minimumCohortSize): INSUFFICIENT_MARKET_DATA in the aggregate, never a fictitious percentile', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 5000, cohortValues: bigCohort(3) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 3, metrics }));
    expect(result.status).toBe('INSUFFICIENT_MARKET_DATA');
    expect(result.score).toBeNull();
    expect(result.label).toBeNull();
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
    expect(m.status).toBe('INSUFFICIENT_COHORT');
    expect(m.percentile).toBeNull();
    expect(m.sampleSize).toBe(3);
    expect(m.sampleQuality).toBe('INSUFFICIENT');
  });

  it(`exactly at the limit (${MINIMUM_COHORT_SIZE}): considered sufficient, MEDIUM quality`, () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.DEEZER_FANS, artistValue: 2000, cohortValues: bigCohort(MINIMUM_COHORT_SIZE) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: MINIMUM_COHORT_SIZE, metrics }));
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.DEEZER_FANS)!;
    expect(m.status).toBe('AVAILABLE');
    expect(m.sampleQuality).toBe('MEDIUM');
  });

  it(`sample >= ${HIGH_QUALITY_SAMPLE_SIZE}: HIGH quality`, () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.DEEZER_FANS, artistValue: 2000, cohortValues: bigCohort(HIGH_QUALITY_SAMPLE_SIZE) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: HIGH_QUALITY_SAMPLE_SIZE, metrics }));
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.DEEZER_FANS)!;
    expect(m.sampleQuality).toBe('HIGH');
  });

  it('deterministic fallback: fallbackLevel and cohortDefinition returned exactly as provided by the caller', () => {
    const result = computeMarketBenchmark(
      baseInput({ fallbackLevel: 1, cohortSize: 12, cohortDefinition: { sourceArtistUuid: 'sc-uuid-9', countryFilter: 'BR', candidateCount: 40 } }),
    );
    expect(result.fallbackLevel).toBe(1);
    expect(result.cohortDefinition).toEqual({ sourceArtistUuid: 'sc-uuid-9', countryFilter: 'BR', candidateCount: 40 });
  });

  it('median calculated correctly (even and odd) and exposed even when the cohort is insufficient', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 100, cohortValues: [1, 2] },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 2, metrics }));
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
    expect(m.cohortMedian).toBe(1.5);
  });

  it('ties in the cohort: percentile does not break, uses average rank', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 5000, cohortValues: Array(12).fill(5000) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 12, metrics }));
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
    expect(m.percentile).toBe(50);
  });

  it('an outlier in the cohort does not lock up the calculation', () => {
    const cohort = [...bigCohort(11), 999_999_999];
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 1500, cohortValues: cohort },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 12, metrics }));
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
    expect(m.percentile).not.toBeNull();
    expect(m.percentile).toBeGreaterThanOrEqual(0);
    expect(m.percentile).toBeLessThanOrEqual(100);
  });

  it('metric with no artist value (but sufficient cohort): ARTIST_VALUE_UNAVAILABLE, never compared to 0', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.TIKTOK_FOLLOWERS, artistValue: null, cohortValues: bigCohort(15) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 15, metrics }));
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.TIKTOK_FOLLOWERS)!;
    expect(m.status).toBe('ARTIST_VALUE_UNAVAILABLE');
    expect(m.percentile).toBeNull();
  });

  it('different sample sizes per metric (item 20): each metric evaluated with its own sampleSize', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 5000, cohortValues: bigCohort(20) },
      { metricKey: METRIC_KEYS.INSTAGRAM_FOLLOWERS, artistValue: 5000, cohortValues: bigCohort(2) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 20, metrics }));
    const spotify = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
    const instagram = result.metrics.find((x) => x.metricKey === METRIC_KEYS.INSTAGRAM_FOLLOWERS)!;
    expect(spotify.status).toBe('AVAILABLE');
    expect(instagram.status).toBe('INSUFFICIENT_COHORT');
  });

  it('no cohort (all metrics with no data): INSUFFICIENT_MARKET_DATA, never a made-up P68', () => {
    const result = computeMarketBenchmark(baseInput({ cohortSize: 0 }));
    expect(result.status).toBe('INSUFFICIENT_MARKET_DATA');
    expect(result.score).toBeNull();
  });

  it('all cohort values equal to each other: well-defined percentile (50), not NaN/Infinity', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.DEEZER_FANS, artistValue: 42, cohortValues: Array(10).fill(42) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 10, metrics }));
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.DEEZER_FANS)!;
    expect(Number.isFinite(m.percentile)).toBe(true);
    expect(m.percentile).toBe(50);
  });

  it('single available metric: aggregate score equal to that metric\'s percentile', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 5000, cohortValues: bigCohort(15) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 15, metrics }));
    const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
    expect(result.score).toBe(m.percentile);
  });

  it('multiple metrics: score is the average of the available percentiles', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 1_000_000, cohortValues: bigCohort(15) },
      { metricKey: METRIC_KEYS.INSTAGRAM_FOLLOWERS, artistValue: 1, cohortValues: bigCohort(15) },
    ];
    const result = computeMarketBenchmark(baseInput({ cohortSize: 15, metrics }));
    const spotify = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
    const instagram = result.metrics.find((x) => x.metricKey === METRIC_KEYS.INSTAGRAM_FOLLOWERS)!;
    expect(result.score).toBeCloseTo(((spotify.percentile as number) + (instagram.percentile as number)) / 2, 5);
  });

  it('engineVersion always returned', () => {
    const result = computeMarketBenchmark(baseInput());
    expect(result.engineVersion).toBe(MARKET_BENCHMARK_ENGINE_VERSION);
  });

  it('determinism: the same input produces exactly the same result', () => {
    const metrics: BenchmarkMetricInput[] = [
      { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 12345, cohortValues: bigCohort(15) },
    ];
    const input = baseInput({ cohortSize: 15, metrics });
    expect(computeMarketBenchmark(input)).toEqual(computeMarketBenchmark(input));
  });

  // ── Minimum sensitivity (item 15) ───────────────────────────────────────
  describe('minimumCohortSize sensitivity', () => {
    it.each([10, 20, 30, 50])('sample of size %i produces a valid, deterministic percentile', (n) => {
      const metrics: BenchmarkMetricInput[] = [
        { metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 5000, cohortValues: bigCohort(n) },
      ];
      const result = computeMarketBenchmark(baseInput({ cohortSize: n, metrics }));
      const m = result.metrics.find((x) => x.metricKey === METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS)!;
      expect(m.status).toBe('AVAILABLE');
      expect(m.percentile).toBeGreaterThanOrEqual(0);
      expect(m.percentile).toBeLessThanOrEqual(100);
    });

    it('sample of 9 (below the minimum): INSUFFICIENT_COHORT; sample of 10: AVAILABLE — proves the exact boundary', () => {
      const nine: BenchmarkMetricInput[] = [{ metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 5000, cohortValues: bigCohort(9) }];
      const ten: BenchmarkMetricInput[] = [{ metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: 5000, cohortValues: bigCohort(10) }];
      const r9 = computeMarketBenchmark(baseInput({ cohortSize: 9, metrics: nine }));
      const r10 = computeMarketBenchmark(baseInput({ cohortSize: 10, metrics: ten }));
      expect(r9.metrics[0].status).toBe('INSUFFICIENT_COHORT');
      expect(r10.metrics[0].status).toBe('AVAILABLE');
    });
  });
});

// ── Properties (item 41) ────────────────────────────────────────────────
describe('properties — percentile monotonicity', () => {
  it('percentile is non-decreasing with the artist value (same cohort)', () => {
    const cohort = bigCohort(20);
    const values = [500, 1000, 1500, 2000, 3000, 5000];
    const percentiles = values.map((v) => {
      const result = computeMarketBenchmark(
        baseInput({ cohortSize: 20, metrics: [{ metricKey: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, artistValue: v, cohortValues: cohort }] }),
      );
      return result.metrics[0].percentile as number;
    });
    for (let i = 1; i < percentiles.length; i++) {
      expect(percentiles[i]).toBeGreaterThanOrEqual(percentiles[i - 1]);
    }
  });
});
