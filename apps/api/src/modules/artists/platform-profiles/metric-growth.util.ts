/**
 * platform-profiles/metric-growth.util.ts
 *
 * Phase 2 — minimal deterministic layer to compute change from real
 * historical points. It is NOT Momentum/Career Stage (no STRONG/VERY_STRONG
 * classification) — only currentValue/previousValue/absoluteChange/
 * percentageChange/period, or INSUFFICIENT_HISTORY when there is no
 * reliable previous point within the period tolerance.
 */

export interface GrowthPoint {
  value: number;
  observedAt: Date;
}

export type GrowthResult =
  | { status: 'INSUFFICIENT_HISTORY'; periodDays: number }
  | {
      status: 'OK';
      periodDays: number;
      currentValue: number;
      currentObservedAt: Date;
      previousValue: number;
      previousObservedAt: Date;
      absoluteChange: number;
      /** null when previousValue === 0 — percentage change is undefined, never Infinity/NaN. */
      percentageChange: number | null;
    };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Selects, among the points before the most recent one, the one closest to
 * `asOf - periodDays` — never `array[0]`/`array[last]` without guaranteeing
 * ordering and real proximity to the requested period. Outside the
 * tolerance → no reliable previous point (INSUFFICIENT_HISTORY), not an
 * overly approximate value.
 */
export function computeGrowth(
  points: GrowthPoint[],
  periodDays: number,
  asOf: Date = new Date(),
  toleranceDays = Math.max(1, Math.round(periodDays * 0.2)),
): GrowthResult {
  if (points.length === 0) return { status: 'INSUFFICIENT_HISTORY', periodDays };

  const sorted = [...points].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  const current = sorted[sorted.length - 1];
  const targetTime = asOf.getTime() - periodDays * MS_PER_DAY;
  const toleranceMs = toleranceDays * MS_PER_DAY;

  let previous: GrowthPoint | null = null;
  let bestDiff = Infinity;
  for (const p of sorted) {
    if (p.observedAt.getTime() >= current.observedAt.getTime()) continue;
    const diff = Math.abs(p.observedAt.getTime() - targetTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      previous = p;
    }
  }

  if (!previous || bestDiff > toleranceMs) return { status: 'INSUFFICIENT_HISTORY', periodDays };

  const absoluteChange = current.value - previous.value;
  const percentageChange = previous.value === 0 ? null : (absoluteChange / previous.value) * 100;

  return {
    status: 'OK',
    periodDays,
    currentValue: current.value,
    currentObservedAt: current.observedAt,
    previousValue: previous.value,
    previousObservedAt: previous.observedAt,
    absoluteChange,
    percentageChange,
  };
}

export const STANDARD_GROWTH_PERIODS_DAYS = [7, 30, 90, 180, 365] as const;
