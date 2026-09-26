/**
 * analytics/metric-normalization.util.ts
 *
 * Phase 3 — deterministic normalization of raw Soundcharts metrics to a
 * 0-100 scale comparable across platforms with very different orders of
 * magnitude (20k followers vs 1.2M YouTube views). Never aggregate/compare
 * raw values directly across metrics with different units (item 36) —
 * every comparison goes through here first.
 */

export type NormalizationStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'ZERO_REAL';

export interface NormalizedScore {
  status: NormalizationStatus;
  /** 0-100, or null when status=UNAVAILABLE. */
  score: number | null;
  rawValue: number | null;
}

/**
 * Bounded logarithmic normalization for audience SIZE metrics
 * (followers/subscribers/monthly listeners/fans/playlist count).
 *
 * Why log and not linear (item 17): real audiences follow a long-tail
 * distribution — the difference between 100 and 1,000 followers is as
 * significant for career stage as the difference between 1M and 10M; a
 * linear scale would compress the whole "small/mid-size artist" range near
 * zero and make the score insensitive to real growth in that range, which
 * is exactly where most of the product's artists are.
 *
 * `ceiling` is a versioned reference value (not a physical limit — values
 * above it are clamped to 100), documented per metric in
 * career-stage.config.ts.
 *
 * Formula: score = 100 * log10(value + 1) / log10(ceiling + 1), clamp [0,100].
 *
 * CALIBRATION (Phase 3.1, item 22 — math audit):
 *   - value = 0        → score = 0   (log10(1) = 0)
 *   - value = ceiling   → score = 100  (log10(ceiling+1)/log10(ceiling+1) = 1)
 *   - value = √ceiling  → score ≈ 50  (log10(√c+1)/log10(c+1) ≈ 0.5, an exact
 *     mathematical property of the log scale: the MIDPOINT in log space between
 *     1 and `ceiling` is the square root of `ceiling`, not `ceiling/2`). Example:
 *     ceiling=50,000,000 → score=50 at ~7,071 (not at 25,000,000) — that is
 *     how a log scale is supposed to work: going 100→1,000 weighs as much as
 *     1M→10M, exactly the rationale of item 17.
 * `ceiling` itself remains a product choice (documented per metric in
 * AUDIENCE_CEILINGS, not a physical constant) — what stopped being
 * arbitrary is HOW a raw value becomes 0-100 given that ceiling: the
 * formula is fixed, tested (metric-normalization.util.spec.ts, "large
 * audience"/"small audience"/anchor cases) and always produces exactly the
 * same number for the same input (determinism proven by test).
 */
export function normalizeAudienceSize(value: number | null | undefined, ceiling: number): NormalizedScore {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return { status: 'UNAVAILABLE', score: null, rawValue: null };
  }
  if (value === 0) {
    // A real zero is real data (item 8) — never UNAVAILABLE, but also not
    // "no audience = neutral": score 0 is the mathematically correct result
    // (log10(1)/log10(ceiling+1) = 0).
    return { status: 'ZERO_REAL', score: 0, rawValue: 0 };
  }
  const raw = 100 * (Math.log10(value + 1) / Math.log10(ceiling + 1));
  return { status: 'AVAILABLE', score: Math.max(0, Math.min(100, raw)), rawValue: value };
}

/**
 * Normalization of percentage change (growth 30d/90d/etc.) to 0-100,
 * centered on 50 (0% growth = neutral).
 *
 * growth is already a relative metric — it needs no log scale — but it
 * needs bounds: a +500% jump for a very small artist (a few dozen
 * followers) must not "break" the scale. `positiveCeiling`/`negativeFloor`
 * (percentages) map to score 100/0; values beyond them are clamped.
 *
 * Not enough history (`percentageChange === null`, including the
 * `previousValue === 0` case from computeGrowth) → UNAVAILABLE, NEVER a
 * forced 50 — 50 only appears when the real measured growth is exactly 0%.
 */
export function normalizeGrowthPercent(
  percentageChange: number | null,
  positiveCeiling: number,
  negativeFloor: number,
): NormalizedScore {
  if (percentageChange == null || !Number.isFinite(percentageChange)) {
    return { status: 'UNAVAILABLE', score: null, rawValue: null };
  }
  if (percentageChange === 0) {
    return { status: 'ZERO_REAL', score: 50, rawValue: 0 };
  }
  const raw =
    percentageChange >= 0
      ? 50 + 50 * Math.min(1, percentageChange / positiveCeiling)
      : 50 - 50 * Math.min(1, Math.abs(percentageChange) / Math.abs(negativeFloor));
  return { status: 'AVAILABLE', score: Math.max(0, Math.min(100, raw)), rawValue: percentageChange };
}

/** Simple mean of the available scores (ignores UNAVAILABLE). null when none is available. */
export function averageAvailable(scores: NormalizedScore[]): number | null {
  const available = scores.filter((s): s is NormalizedScore & { score: number } => s.score != null);
  if (available.length === 0) return null;
  return available.reduce((acc, s) => acc + s.score, 0) / available.length;
}

/** Median of a numeric sample — correct for even and odd sizes, unsorted input. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Percentile of the artist's value within a cohort (0-100): "% of the cohort
 * with a lower or equal value, ties counting as half" — the standard
 * mid-rank method for ties, it prevents a cluster of equal values from
 * pushing the percentile artificially up or down. Deterministic for
 * unsorted input, small samples, outliers and negative values (growth can
 * be negative — handled normally, no special case).
 */
export function percentileRank(cohortValues: number[], artistValue: number): number | null {
  if (cohortValues.length === 0) return null;
  const below = cohortValues.filter((v) => v < artistValue).length;
  const equal = cohortValues.filter((v) => v === artistValue).length;
  const rank = below + equal / 2;
  return (rank / cohortValues.length) * 100;
}
