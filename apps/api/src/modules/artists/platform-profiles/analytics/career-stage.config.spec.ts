import { DIMENSION_METRICS, GROWTH_ELIGIBLE_METRICS, CAREER_STAGE_WEIGHTS, AUDIENCE_CEILINGS } from './career-stage.config';
import { METRIC_KEYS } from '../metric-keys';

/**
 * career-stage.config.spec.ts
 *
 * Phase 3.1 — double counting audit (item 28): structurally guarantees that
 * no size/audience metric contributes to more than one size dimension
 * (AUDIENCE/STREAMING/SOCIAL/MARKET_PRESENCE) at the same time — regression
 * for the real finding (Spotify counted in both AUDIENCE and STREAMING).
 * GROWTH/MOMENTUM are auxiliary and legitimately reuse the same base-metric
 * set (they are a different transformation — rate of change, not size — not
 * double counting).
 */
describe('DIMENSION_METRICS — no double counting between size dimensions', () => {
  it('no metric appears in more than one size dimension', () => {
    const seen = new Map<string, string>();
    for (const [dimension, metrics] of Object.entries(DIMENSION_METRICS)) {
      for (const metric of metrics) {
        const owner = seen.get(metric);
        if (owner) throw new Error(`metric ${metric} already belongs to ${owner}, cannot also belong to ${dimension}`);
        seen.set(metric, dimension);
      }
    }
  });

  it('SPOTIFY_MONTHLY_LISTENERS belongs exclusively to STREAMING (regression for the real finding)', () => {
    expect(DIMENSION_METRICS.AUDIENCE).not.toContain(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS);
    expect(DIMENSION_METRICS.STREAMING).toContain(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS);
  });

  it('every metric with a configured ceiling is used in at least one dimension or growth (no orphan ceiling)', () => {
    const usedInDimensions = new Set(Object.values(DIMENSION_METRICS).flat());
    const usedInGrowth = new Set(GROWTH_ELIGIBLE_METRICS);
    for (const metric of Object.keys(AUDIENCE_CEILINGS) as (keyof typeof AUDIENCE_CEILINGS)[]) {
      const used = usedInDimensions.has(metric) || usedInGrowth.has(metric);
      // YOUTUBE_VIEWS/YOUTUBE_VIDEOS have a documented ceiling for future use
      // of YouTube history, but do not feed any dimension today — a known
      // exception, not a bug.
      if (metric === METRIC_KEYS.YOUTUBE_VIEWS || metric === METRIC_KEYS.YOUTUBE_VIDEOS) continue;
      if (!used) throw new Error(`ceiling configured for ${metric} but not used in any dimension/growth`);
    }
  });
});

describe('CAREER_STAGE_WEIGHTS', () => {
  it('covers exactly the engine\'s 6 dimensions, no more and no less', () => {
    expect(Object.keys(CAREER_STAGE_WEIGHTS).sort()).toEqual(
      ['AUDIENCE', 'GROWTH', 'MARKET_PRESENCE', 'MOMENTUM', 'SOCIAL', 'STREAMING'].sort(),
    );
  });
});
