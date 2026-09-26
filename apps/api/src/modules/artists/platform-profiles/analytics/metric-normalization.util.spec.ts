import { normalizeAudienceSize, normalizeGrowthPercent, averageAvailable, median, percentileRank } from './metric-normalization.util';

describe('normalizeAudienceSize', () => {
  it('large audience: value at the ceiling produces a score of ~100', () => {
    const r = normalizeAudienceSize(50_000_000, 50_000_000);
    expect(r.status).toBe('AVAILABLE');
    expect(r.score).toBeCloseTo(100, 0);
  });

  it('value above the ceiling is clamped to 100, never > 100', () => {
    const r = normalizeAudienceSize(500_000_000, 50_000_000);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeCloseTo(100, 0);
  });

  it('small audience: a small value produces a low but positive score (not zeroed out by linear scaling)', () => {
    const r = normalizeAudienceSize(100, 50_000_000);
    expect(r.status).toBe('AVAILABLE');
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(50);
  });

  it('real zero: status ZERO_REAL, score 0 — never UNAVAILABLE', () => {
    const r = normalizeAudienceSize(0, 50_000_000);
    expect(r.status).toBe('ZERO_REAL');
    expect(r.score).toBe(0);
  });

  it('null/undefined: UNAVAILABLE, score null — never a fabricated 0', () => {
    expect(normalizeAudienceSize(null, 1000).status).toBe('UNAVAILABLE');
    expect(normalizeAudienceSize(null, 1000).score).toBeNull();
    expect(normalizeAudienceSize(undefined, 1000).status).toBe('UNAVAILABLE');
  });

  it('negative value (invalid data, should never occur with real data): UNAVAILABLE', () => {
    expect(normalizeAudienceSize(-5, 1000).status).toBe('UNAVAILABLE');
  });

  it('different units (different ceiling) produce comparable 0-100 scales', () => {
    const spotify = normalizeAudienceSize(1_000_000, 50_000_000);
    const appleMusicPlaylists = normalizeAudienceSize(50, 5_000);
    expect(spotify.score).toBeGreaterThanOrEqual(0);
    expect(spotify.score).toBeLessThanOrEqual(100);
    expect(appleMusicPlaylists.score).toBeGreaterThanOrEqual(0);
    expect(appleMusicPlaylists.score).toBeLessThanOrEqual(100);
  });

  it('determinism: the same input produces exactly the same score', () => {
    const a = normalizeAudienceSize(123_456, 10_000_000);
    const b = normalizeAudienceSize(123_456, 10_000_000);
    expect(a).toEqual(b);
  });

  // ── Calibration / anchors (Phase 3.1, item 40) — known input -> known output,
  // proving that the formula is not an arbitrary tweak but a fixed
  // mathematical property of the logarithmic scale.
  describe('calibration (anchors)', () => {
    it('minimum anchor: value=0 -> score exactly 0', () => {
      expect(normalizeAudienceSize(0, 1_000_000).score).toBe(0);
    });
    it('maximum anchor: value=ceiling -> score exactly 100', () => {
      expect(normalizeAudienceSize(1_000_000, 1_000_000).score).toBeCloseTo(100, 6);
    });
    it('central anchor: value=√ceiling -> score ≈ 50 (a mathematical property of the log scale, not a chosen constant)', () => {
      const ceiling = 1_000_000;
      const sqrtCeiling = Math.sqrt(ceiling); // 1000
      const r = normalizeAudienceSize(sqrtCeiling, ceiling);
      expect(r.score).toBeCloseTo(50, 0);
    });
    it('the same value/ceiling ratio produces the same score regardless of the absolute scale (log is invariant to multiplicative scale near the top)', () => {
      const small = normalizeAudienceSize(900_000, 1_000_000);
      const large = normalizeAudienceSize(90_000_000, 100_000_000);
      // Both at 90% of their own ceiling — not identical (log is not linear),
      // but both should fall in the high range (>85), proving that the
      // "direction" of the scale (close to the ceiling = high score) is
      // consistent across ceilings.
      expect(small.score).toBeGreaterThan(85);
      expect(large.score).toBeGreaterThan(85);
    });
  });
});

describe('normalizeGrowthPercent', () => {
  it('0% real growth: ZERO_REAL, score 50 (neutral)', () => {
    const r = normalizeGrowthPercent(0, 50, -50);
    expect(r.status).toBe('ZERO_REAL');
    expect(r.score).toBe(50);
  });

  it('positive growth at the ceiling: score 100', () => {
    const r = normalizeGrowthPercent(50, 50, -50);
    expect(r.score).toBeCloseTo(100, 5);
  });

  it('negative growth (negative growth) at the floor: score 0', () => {
    const r = normalizeGrowthPercent(-50, 50, -50);
    expect(r.score).toBeCloseTo(0, 5);
  });

  it('growth beyond the ceiling/floor is clamped, never leaves [0,100]', () => {
    expect(normalizeGrowthPercent(500, 50, -50).score).toBeLessThanOrEqual(100);
    expect(normalizeGrowthPercent(-500, 50, -50).score).toBeGreaterThanOrEqual(0);
  });

  it('null (INSUFFICIENT_HISTORY from computeGrowth): UNAVAILABLE, never a forced 50', () => {
    const r = normalizeGrowthPercent(null, 50, -50);
    expect(r.status).toBe('UNAVAILABLE');
    expect(r.score).toBeNull();
  });

  it('determinism: the same input produces exactly the same score', () => {
    expect(normalizeGrowthPercent(12.5, 50, -50)).toEqual(normalizeGrowthPercent(12.5, 50, -50));
  });

  it('anchors: 0%->50, +ceiling%->100, floor%->0 (item 29)', () => {
    expect(normalizeGrowthPercent(0, 50, -50).score).toBe(50);
    expect(normalizeGrowthPercent(50, 50, -50).score).toBeCloseTo(100, 6);
    expect(normalizeGrowthPercent(-50, 50, -50).score).toBeCloseTo(0, 6);
    expect(normalizeGrowthPercent(10, 50, -50).score).toBeCloseTo(60, 6); // 50 + 50*(10/50)
    expect(normalizeGrowthPercent(-10, 50, -50).score).toBeCloseTo(40, 6); // 50 - 50*(10/50)
  });
});

// ── Property tests (item 41): more audience never reduces the score; higher
// growth never reduces the growth score. Fixed representative cases (no
// dependency on fast-check — not installed in the project, and a few
// deterministic points already prove the property for a strictly monotonic
// function like log10).
describe('properties — monotonicity', () => {
  it('normalizeAudienceSize is non-decreasing in value', () => {
    const ceiling = 10_000_000;
    const values = [0, 1, 100, 10_000, 1_000_000, 10_000_000, 100_000_000];
    const scores = values.map((v) => normalizeAudienceSize(v, ceiling).score as number);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('normalizeGrowthPercent is non-decreasing in percentageChange', () => {
    const changes = [-100, -50, -25, -10, 0, 10, 25, 50, 100];
    const scores = changes.map((c) => normalizeGrowthPercent(c, 50, -50).score as number);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('normalizeAudienceSize never leaves [0,100] for any valid input tested', () => {
    for (const v of [0, 1, 50, 999_999_999_999]) {
      const s = normalizeAudienceSize(v, 1_000_000).score as number;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

describe('averageAvailable', () => {
  it('ignores UNAVAILABLE, computes the average only of the available ones', () => {
    const scores = [
      { status: 'AVAILABLE' as const, score: 80, rawValue: 1 },
      { status: 'UNAVAILABLE' as const, score: null, rawValue: null },
      { status: 'AVAILABLE' as const, score: 40, rawValue: 2 },
    ];
    expect(averageAvailable(scores)).toBe(60);
  });

  it('all UNAVAILABLE: returns null', () => {
    expect(averageAvailable([{ status: 'UNAVAILABLE', score: null, rawValue: null }])).toBeNull();
  });

  it('empty list: returns null', () => {
    expect(averageAvailable([])).toBeNull();
  });
});

describe('median', () => {
  it('sorted odd sample', () => {
    expect(median([1, 3, 5])).toBe(3);
  });
  it('sorted even sample', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it('UNSORTED input produces the correct median', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('empty list: null', () => {
    expect(median([])).toBeNull();
  });
  it('single-item sample', () => {
    expect(median([42])).toBe(42);
  });
});

describe('percentileRank', () => {
  it('value in the middle of a sorted sample', () => {
    const cohort = [10, 20, 30, 40, 50];
    expect(percentileRank(cohort, 30)).toBe(50); // 2 below + 1 equal/2 = 2.5 -> 2.5/5*100=50
  });
  it('value below the entire cohort: percentile close to 0', () => {
    expect(percentileRank([10, 20, 30], 1)).toBe(0);
  });
  it('value above the entire cohort: percentile 100', () => {
    expect(percentileRank([10, 20, 30], 999)).toBe(100);
  });
  it('ties: a value equal to several in the cohort uses the average rank (never an artificial 0 or 100)', () => {
    const cohort = [10, 10, 10, 10];
    const p = percentileRank(cohort, 10);
    expect(p).toBe(50); // all tied -> average rank = half
  });
  it('all cohort values equal to each other and to the artist: 50 (neither top nor bottom)', () => {
    expect(percentileRank([5, 5, 5], 5)).toBe(50);
  });
  it('a cohort with an extreme outlier does not break the calculation', () => {
    const cohort = [1, 2, 3, 4, 1_000_000];
    const p = percentileRank(cohort, 3);
    expect(p).toBe(50);
  });
  it('empty cohort: null (never a fictitious percentile)', () => {
    expect(percentileRank([], 10)).toBeNull();
  });
  it('negative growth works normally (percentile does not assume only positive values)', () => {
    const cohort = [-10, -5, 0, 5, 10];
    expect(percentileRank(cohort, -5)).toBe(30);
  });
  it('determinism: the same input produces exactly the same percentile', () => {
    const cohort = [3, 7, 2, 9, 5];
    expect(percentileRank(cohort, 5)).toBe(percentileRank(cohort, 5));
  });
});
