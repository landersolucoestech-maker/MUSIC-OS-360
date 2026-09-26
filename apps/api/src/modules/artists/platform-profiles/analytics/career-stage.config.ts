/**
 * analytics/career-stage.config.ts
 *
 * Phase 3 — centralized, versioned Career Stage Engine configuration.
 * No weight/threshold/ceiling conditional scattered across UI/service code
 * (item 12) — everything is here, tested in career-stage.engine.spec.ts.
 *
 * MODEL: ABSOLUTE / MODEL-BASED (Phase 3.1, item 23) — each metric is compared
 * against a FIXED, versioned `ceiling` (see AUDIENCE_CEILINGS), never against
 * other artists. "Career stage" measures absolute maturity under this model,
 * not a position relative to peers. Relative comparison (percentile vs. the
 * real market) is the EXCLUSIVE responsibility of the Market Benchmark Engine
 * (market-benchmark.engine.ts) — the two never mix: Career Stage reads no
 * Benchmark result, and the Benchmark never uses Career Stage's normalized
 * score as input (it always uses the raw metric value — see
 * market-benchmark.engine.ts item 19).
 */
import { METRIC_KEYS, type MetricKey } from '../metric-keys';

// Phase 3.1: bump for a formula change (AUDIENCE no longer includes
// SPOTIFY_MONTHLY_LISTENERS — fixes double counting with STREAMING, item 28).
// Snapshots written with engine_version=1.0.0 stay in the database
// (append-only) and are not recomputed retroactively.
export const CAREER_STAGE_ENGINE_VERSION = '1.1.0';

export type CareerStageDimensionKey = 'AUDIENCE' | 'STREAMING' | 'SOCIAL' | 'MARKET_PRESENCE' | 'GROWTH' | 'MOMENTUM';

export const CAREER_STAGE_DIMENSION_KEYS: CareerStageDimensionKey[] = [
  'AUDIENCE', 'STREAMING', 'SOCIAL', 'MARKET_PRESENCE', 'GROWTH', 'MOMENTUM',
];

/**
 * Sum to exactly 100 (tested). AUDIENCE has the highest weight as the broadest
 * signal (sum of reach across music consumption platforms). STREAMING stands
 * alone as the most direct "people really listen" signal — distinct from passive
 * followers. SOCIAL covers Instagram/TikTok (pure social engagement, outside
 * direct music consumption). MARKET_PRESENCE (Apple Music playlist count) has a
 * low weight because it is currently the dimension with the lowest real observed
 * coverage (Soundcharts investigation, Phase 3). GROWTH and MOMENTUM are
 * auxiliary (short and long term, respectively).
 */
export const CAREER_STAGE_WEIGHTS: Record<CareerStageDimensionKey, number> = {
  AUDIENCE: 25,
  STREAMING: 20,
  SOCIAL: 20,
  MARKET_PRESENCE: 10,
  GROWTH: 20,
  MOMENTUM: 5,
};

/**
 * Metrics feeding each size/audience dimension (current value,
 * log-normalized).
 *
 * AUDIT 2026-08-31 (Phase 3.1, item 28 — double counting):
 * SPOTIFY_MONTHLY_LISTENERS lived in AUDIENCE and STREAMING at the same time,
 * overweighting Spotify relative to YouTube/Deezer/SoundCloud (which contribute
 * only once). Fixed: AUDIENCE now covers exclusively the reach of PLATFORMS NOT
 * covered by another dimension (YouTube/Deezer/SoundCloud — "how many people
 * follow/watch you outside Spotify"); STREAMING stays isolated on Spotify (the
 * most direct "people really listen" signal). Each audience metric now
 * contributes to EXACTLY one size dimension — verified by a test
 * (career-stage.config.spec.ts).
 */
export const DIMENSION_METRICS: Record<'AUDIENCE' | 'STREAMING' | 'SOCIAL' | 'MARKET_PRESENCE', MetricKey[]> = {
  AUDIENCE: [
    METRIC_KEYS.YOUTUBE_SUBSCRIBERS,
    METRIC_KEYS.DEEZER_FANS,
    METRIC_KEYS.SOUNDCLOUD_FOLLOWERS,
  ],
  STREAMING: [METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS],
  SOCIAL: [METRIC_KEYS.INSTAGRAM_FOLLOWERS, METRIC_KEYS.TIKTOK_FOLLOWERS],
  MARKET_PRESENCE: [METRIC_KEYS.APPLE_MUSIC_PLAYLIST_COUNT],
};

/**
 * Metrics eligible for the growth dimensions — GROWTH uses the 30d window
 * (short term), MOMENTUM uses 90d (medium-term trend). The same base metric set
 * (audience) behind AUDIENCE/STREAMING/SOCIAL — it reuses the already-ingested
 * history (Phase 2), never a new call.
 */
export const GROWTH_ELIGIBLE_METRICS: MetricKey[] = [
  METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS,
  METRIC_KEYS.YOUTUBE_SUBSCRIBERS,
  METRIC_KEYS.DEEZER_FANS,
  METRIC_KEYS.SOUNDCLOUD_FOLLOWERS,
  METRIC_KEYS.INSTAGRAM_FOLLOWERS,
  METRIC_KEYS.TIKTOK_FOLLOWERS,
];

/**
 * Reference value (not a physical limit) that maps to score=100 in each
 * metric's logarithmic normalization — see metric-normalization.util.ts. The
 * orders of magnitude reflect the realistic audience ceiling of each platform
 * for a typical independent/emerging artist of the product, not the
 * platform's world record.
 */
export const AUDIENCE_CEILINGS: Record<MetricKey, number> = {
  [METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS]: 50_000_000,
  [METRIC_KEYS.YOUTUBE_SUBSCRIBERS]: 30_000_000,
  [METRIC_KEYS.YOUTUBE_VIEWS]: 500_000_000,
  [METRIC_KEYS.YOUTUBE_VIDEOS]: 2_000,
  [METRIC_KEYS.DEEZER_FANS]: 10_000_000,
  [METRIC_KEYS.SOUNDCLOUD_FOLLOWERS]: 10_000_000,
  [METRIC_KEYS.INSTAGRAM_FOLLOWERS]: 50_000_000,
  [METRIC_KEYS.TIKTOK_FOLLOWERS]: 50_000_000,
  [METRIC_KEYS.APPLE_MUSIC_PLAYLIST_COUNT]: 5_000,
};

/** +50%/-50% over the period map to score 100/0 — see normalizeGrowthPercent. */
export const GROWTH_POSITIVE_CEILING = 50;
export const GROWTH_NEGATIVE_FLOOR = -50;

/**
 * Coverage gate (item 14): below these minimums the result is
 * INSUFFICIENT_DATA — never a score computed over a single isolated metric.
 */
export const CAREER_STAGE_COVERAGE_GATE = {
  minimumAvailableDimensions: 2,
  /** Fraction of the total weight (0-1) that must be covered by available dimensions. */
  minimumCoverageWeight: 0.3,
};

/** Data reliability still usable, but flagged as potentially stale. */
export const STALE_AFTER_DAYS = 14;

export interface CareerStageClassificationBand {
  min: number;
  max: number;
  label: string;
}

/** Item 15 thresholds — configuration, not a scattered conditional. */
export const CAREER_STAGE_CLASSIFICATION: CareerStageClassificationBand[] = [
  { min: 0.0, max: 1.9, label: 'Início' },
  { min: 2.0, max: 3.9, label: 'Emergente' },
  { min: 4.0, max: 5.9, label: 'Em Desenvolvimento' },
  { min: 6.0, max: 7.4, label: 'Em Ascensão' },
  { min: 7.5, max: 8.9, label: 'Consolidado' },
  { min: 9.0, max: 10.0, label: 'Alta Relevância' },
];

/** A dimension counts as a positive factor/bottleneck outside this neutral band (score 0-100). */
export const EXPLAINABILITY_THRESHOLDS = { positive: 65, bottleneck: 35 };
