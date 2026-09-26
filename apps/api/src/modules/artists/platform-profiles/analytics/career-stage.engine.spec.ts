import { computeCareerStage, type CareerStageEngineInput, type CareerStageMetricPoint } from './career-stage.engine';
import { METRIC_KEYS } from '../metric-keys';
import { CAREER_STAGE_WEIGHTS, CAREER_STAGE_CLASSIFICATION, CAREER_STAGE_ENGINE_VERSION } from './career-stage.config';
import type { GrowthResult } from '../metric-growth.util';

const ASOF = new Date('2026-08-31T00:00:00Z');

function point(metricKey: (typeof METRIC_KEYS)[keyof typeof METRIC_KEYS], overrides: Partial<CareerStageMetricPoint> = {}): CareerStageMetricPoint {
  return { metricKey, currentValue: null, observedAt: null, growth30d: null, growth90d: null, ...overrides };
}

function growthOk(percentageChange: number): GrowthResult {
  return {
    status: 'OK',
    periodDays: 30,
    currentValue: 100,
    currentObservedAt: ASOF,
    previousValue: 90,
    previousObservedAt: new Date('2026-08-01'),
    absoluteChange: 10,
    percentageChange,
  };
}

function baseInput(overrides: Partial<CareerStageEngineInput> = {}): CareerStageEngineInput {
  return {
    artistId: 'artist-1',
    asOf: ASOF,
    metrics: [],
    platformsWithData: 0,
    mostRecentObservedAt: null,
    historyDepthDays: null,
    ...overrides,
  };
}

describe('CAREER_STAGE_WEIGHTS', () => {
  it('adds up to exactly 100', () => {
    const total = Object.values(CAREER_STAGE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

describe('computeCareerStage', () => {
  it('no metric available: INSUFFICIENT_DATA, score null, but dimensions filled in for transparency', () => {
    const result = computeCareerStage(baseInput());
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.classification).toBeNull();
    expect(result.dimensions).toHaveLength(6);
    expect(result.dimensions.every((d) => d.status === 'UNAVAILABLE')).toBe(true);
  });

  it('all dimensions available with strong data: high score, matching classification', () => {
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, { currentValue: 40_000_000, observedAt: ASOF, growth30d: growthOk(20), growth90d: growthOk(40) }),
      point(METRIC_KEYS.YOUTUBE_SUBSCRIBERS, { currentValue: 20_000_000, observedAt: ASOF, growth30d: growthOk(15), growth90d: growthOk(30) }),
      point(METRIC_KEYS.DEEZER_FANS, { currentValue: 8_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.SOUNDCLOUD_FOLLOWERS, { currentValue: 8_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.INSTAGRAM_FOLLOWERS, { currentValue: 40_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.TIKTOK_FOLLOWERS, { currentValue: 40_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.APPLE_MUSIC_PLAYLIST_COUNT, { currentValue: 4_000, observedAt: ASOF }),
    ];
    const result = computeCareerStage(baseInput({ metrics, platformsWithData: 7, mostRecentObservedAt: ASOF, historyDepthDays: 365 }));
    expect(result.status).toBe('OK');
    expect(result.score).toBeGreaterThan(8);
    expect(result.classification).toBe('Alta Relevância');
    expect(result.dimensions.every((d) => d.status === 'AVAILABLE')).toBe(true);
  });

  it('partial dimensions: sufficient coverage still produces OK, renormalized over the available weights', () => {
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.YOUTUBE_SUBSCRIBERS, { currentValue: 1_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, { currentValue: 1_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.INSTAGRAM_FOLLOWERS, { currentValue: 500_000, observedAt: ASOF }),
    ];
    const result = computeCareerStage(baseInput({ metrics, platformsWithData: 3, mostRecentObservedAt: ASOF }));
    expect(result.status).toBe('OK');
    expect(result.score).not.toBeNull();
    // AUDIENCE (youtube), STREAMING (spotify) and SOCIAL (instagram) available -> coverage = (25+20+20)/100
    expect(result.coverage).toBeCloseTo(0.65, 5);
  });

  it('insufficient dimensions (< minimumAvailableDimensions or < minimumCoverageWeight): INSUFFICIENT_DATA even with 1 real metric', () => {
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.APPLE_MUSIC_PLAYLIST_COUNT, { currentValue: 5, observedAt: ASOF }),
    ];
    // Only MARKET_PRESENCE available: 1 dimension, 10% weight -> below both minimums.
    const result = computeCareerStage(baseInput({ metrics, platformsWithData: 1, mostRecentObservedAt: ASOF }));
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
  });

  it('renormalization: an unavailable dimension is never treated as score 0 (does not pull the average down)', () => {
    // Two dimensions available with maximum score (~100) and nothing else.
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, { currentValue: 50_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.INSTAGRAM_FOLLOWERS, { currentValue: 50_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.TIKTOK_FOLLOWERS, { currentValue: 50_000_000, observedAt: ASOF }),
    ];
    const result = computeCareerStage(baseInput({ metrics, platformsWithData: 2, mostRecentObservedAt: ASOF }));
    expect(result.status).toBe('OK');
    // If missing dimensions counted as 0, the score would fall well below 9;
    // renormalized over the available weights, it should stay close to the maximum.
    expect(result.score).toBeGreaterThan(9);
  });

  it('real score 0 (ZERO_REAL on every metric): AVAILABLE dimension with score 0, never UNAVAILABLE', () => {
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, { currentValue: 0, observedAt: ASOF }),
      point(METRIC_KEYS.INSTAGRAM_FOLLOWERS, { currentValue: 0, observedAt: ASOF }),
      point(METRIC_KEYS.TIKTOK_FOLLOWERS, { currentValue: 0, observedAt: ASOF }),
    ];
    const result = computeCareerStage(baseInput({ metrics, platformsWithData: 2, mostRecentObservedAt: ASOF }));
    const streaming = result.dimensions.find((d) => d.key === 'STREAMING')!;
    expect(streaming.status).toBe('AVAILABLE');
    expect(streaming.score).toBe(0);
    expect(result.status).toBe('OK');
    expect(result.score).toBe(0);
    expect(result.classification).toBe('Início');
  });

  it('score always stays within [0,10]', () => {
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, { currentValue: 500_000_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.INSTAGRAM_FOLLOWERS, { currentValue: 500_000_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.TIKTOK_FOLLOWERS, { currentValue: 500_000_000_000, observedAt: ASOF }),
    ];
    const result = computeCareerStage(baseInput({ metrics, platformsWithData: 2, mostRecentObservedAt: ASOF }));
    expect(result.score).not.toBeNull();
    expect(result.score as number).toBeLessThanOrEqual(10);
    expect(result.score as number).toBeGreaterThanOrEqual(0);
  });

  it('classification thresholds cover the entire 0-10 range with no gap', () => {
    for (let s = 0; s <= 100; s++) {
      const score = s / 10;
      const band = CAREER_STAGE_CLASSIFICATION.find((b) => score >= b.min && score <= b.max);
      expect(band).toBeDefined();
    }
  });

  it('confidence is sensitive to stale data (> STALE_AFTER_DAYS): confidence lower than with fresh data', () => {
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, { currentValue: 1_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.INSTAGRAM_FOLLOWERS, { currentValue: 500_000, observedAt: ASOF }),
    ];
    const fresh = computeCareerStage(baseInput({ metrics, platformsWithData: 2, mostRecentObservedAt: ASOF, historyDepthDays: 90 }));
    const staleDate = new Date(ASOF.getTime() - 60 * 24 * 60 * 60 * 1000);
    const stale = computeCareerStage(baseInput({ metrics, platformsWithData: 2, mostRecentObservedAt: staleDate, historyDepthDays: 90 }));
    expect(stale.confidence).toBeLessThan(fresh.confidence);
    expect(fresh.freshness).toBe('FRESH');
    expect(stale.freshness).toBe('STALE');
  });

  it('freshness UNKNOWN when there is no observedAt at all', () => {
    const result = computeCareerStage(baseInput());
    expect(result.freshness).toBe('UNKNOWN');
  });

  it('engineVersion is always returned and matches the config', () => {
    const result = computeCareerStage(baseInput());
    expect(result.engineVersion).toBe(CAREER_STAGE_ENGINE_VERSION);
  });

  it('positiveFactors/bottlenecks point to concrete data (metricKey + rawValue), never an empty phrase', () => {
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, { currentValue: 50_000_000, observedAt: ASOF }),
      point(METRIC_KEYS.INSTAGRAM_FOLLOWERS, { currentValue: 10, observedAt: ASOF }),
      point(METRIC_KEYS.TIKTOK_FOLLOWERS, { currentValue: 10, observedAt: ASOF }),
    ];
    const result = computeCareerStage(baseInput({ metrics, platformsWithData: 2, mostRecentObservedAt: ASOF }));
    expect(result.positiveFactors.length).toBeGreaterThan(0);
    expect(result.bottlenecks.length).toBeGreaterThan(0);
    for (const item of [...result.positiveFactors, ...result.bottlenecks]) {
      expect(item.metrics.length).toBeGreaterThan(0);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });

  it('determinism: the same input produces exactly the same result', () => {
    const metrics: CareerStageMetricPoint[] = [
      point(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS, { currentValue: 1_234_567, observedAt: ASOF, growth30d: growthOk(5.5) }),
      point(METRIC_KEYS.INSTAGRAM_FOLLOWERS, { currentValue: 654_321, observedAt: ASOF }),
    ];
    const input = baseInput({ metrics, platformsWithData: 2, mostRecentObservedAt: ASOF, historyDepthDays: 60 });
    const a = computeCareerStage(input);
    const b = computeCareerStage(input);
    expect(a).toEqual(b);
  });
});
