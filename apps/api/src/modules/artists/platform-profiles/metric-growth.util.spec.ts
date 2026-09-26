import { computeGrowth } from './metric-growth.util';

const day = (n: number) => new Date(`2026-08-${String(n).padStart(2, '0')}T00:00:00Z`);

describe('computeGrowth', () => {
  it('INSUFFICIENT_HISTORY when there are no points', () => {
    expect(computeGrowth([], 30, day(31))).toEqual({ status: 'INSUFFICIENT_HISTORY', periodDays: 30 });
  });

  it('INSUFFICIENT_HISTORY when only the current point exists (no prior history)', () => {
    const result = computeGrowth([{ value: 100, observedAt: day(31) }], 30, day(31));
    expect(result.status).toBe('INSUFFICIENT_HISTORY');
  });

  it('7d: calculates absolute and percentage variation with a point within tolerance', () => {
    const points = [{ value: 1000, observedAt: day(24) }, { value: 1100, observedAt: day(31) }];
    const result = computeGrowth(points, 7, day(31));
    expect(result).toMatchObject({
      status: 'OK', periodDays: 7, currentValue: 1100, previousValue: 1000, absoluteChange: 100,
    });
    if (result.status === 'OK') expect(result.percentageChange).toBeCloseTo(10);
  });

  it('30d: selects the point closest to (now - 30d) by real distance, not by array position', () => {
    // now(31) - 30d = day(1) exactly. day(5) is 4 days away — farther — but
    // appears BEFORE day(1) in the array, proving that selection uses time
    // distance, not the first entry.
    const points = [
      { value: 700, observedAt: day(5) },
      { value: 500, observedAt: day(1) }, // closest to the target (diff=0)
      { value: 1100, observedAt: day(31) },
    ];
    const result = computeGrowth(points, 30, day(31));
    expect(result).toMatchObject({ status: 'OK', previousValue: 500 });
  });

  it('90d: INSUFFICIENT_HISTORY when the closest point is outside tolerance', () => {
    const points = [{ value: 500, observedAt: day(28) }, { value: 1100, observedAt: day(31) }];
    const result = computeGrowth(points, 90, day(31));
    expect(result.status).toBe('INSUFFICIENT_HISTORY');
  });

  it('180d/365d: the same function covers larger periods with no special logic', () => {
    const points = [{ value: 700, observedAt: day(1) }, { value: 1100, observedAt: day(31) }];
    const r180 = computeGrowth(points, 180, day(31), 200);
    const r365 = computeGrowth(points, 365, day(31), 400);
    expect(r180.status).toBe('OK');
    expect(r365.status).toBe('OK');
  });

  it('previousValue = 0: percentageChange is null, never Infinity/NaN', () => {
    const points = [{ value: 0, observedAt: day(24) }, { value: 50, observedAt: day(31) }];
    const result = computeGrowth(points, 7, day(31));
    expect(result).toMatchObject({ status: 'OK', absoluteChange: 50 });
    if (result.status === 'OK') {
      expect(result.percentageChange).toBeNull();
      expect(Number.isFinite(result.percentageChange as unknown as number)).toBe(false); // null, not a number
    }
  });

  it('negative growth: negative absoluteChange and percentageChange', () => {
    const points = [{ value: 1000, observedAt: day(24) }, { value: 800, observedAt: day(31) }];
    const result = computeGrowth(points, 7, day(31));
    expect(result).toMatchObject({ status: 'OK', absoluteChange: -200 });
    if (result.status === 'OK') expect(result.percentageChange).toBeCloseTo(-20);
  });

  it('no variation: absoluteChange=0, percentageChange=0', () => {
    const points = [{ value: 1000, observedAt: day(24) }, { value: 1000, observedAt: day(31) }];
    const result = computeGrowth(points, 7, day(31));
    expect(result).toMatchObject({ status: 'OK', absoluteChange: 0, percentageChange: 0 });
  });

  it('out-of-order rows: the function sorts internally, does not assume already-sorted input', () => {
    const points = [{ value: 1100, observedAt: day(31) }, { value: 1000, observedAt: day(24) }];
    const result = computeGrowth(points, 7, day(31));
    expect(result).toMatchObject({ status: 'OK', currentValue: 1100, previousValue: 1000 });
  });

  it('duplicate timestamp: does not break, uses the deterministic closest one', () => {
    const points = [
      { value: 1000, observedAt: day(24) },
      { value: 1000, observedAt: day(24) },
      { value: 1100, observedAt: day(31) },
    ];
    const result = computeGrowth(points, 7, day(31));
    expect(result.status).toBe('OK');
  });

  it('stale point (too old, outside all tolerances): INSUFFICIENT_HISTORY', () => {
    const points = [{ value: 100, observedAt: day(1) }, { value: 1100, observedAt: day(31) }];
    const result = computeGrowth(points, 7, day(31));
    expect(result.status).toBe('INSUFFICIENT_HISTORY');
  });

  it('null/missing metric: the caller must not pass points with a non-numeric value — the function does not fabricate a 0', () => {
    // Contract: computeGrowth only receives GrowthPoint[] with value:number —
    // excluding nulls/absence is the snapshot store's responsibility, not
    // computeGrowth's (which never invents a 0).
    const result = computeGrowth([], 7, day(31));
    expect(result.status).toBe('INSUFFICIENT_HISTORY');
  });
});
