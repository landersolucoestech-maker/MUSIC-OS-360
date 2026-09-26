/**
 * analytics/market-benchmark.config.ts
 *
 * Phase 3.1 — fix of the reported conceptual defect: Phase 3 used "other artists
 * of the same tenant" as the cohort, which confuses the tenant (a
 * SECURITY/OWNERSHIP boundary) with the MARKET (the real comparable
 * population). The cohort now comes from real EXTERNAL artists discovered via
 * Soundcharts `/related` (confirmed live, DJ Stay: 40 real candidates, each with
 * real metrics fetchable directly by the Soundcharts UUID — see
 * SoundchartsService.getRelatedArtists/getArtistCountryCode).
 *
 * Internal comparison between artists of the SAME tenant (what Phase 3 did) is
 * still a legitimate indicator — it just cannot be called "Market Benchmark".
 * It is not implemented in this mission as a separate product (outside this
 * mission's request); if the product wants it in the future, it is a
 * PORTFOLIO/TENANT BENCHMARK, a different domain (item 14).
 */
import { METRIC_KEYS, type MetricKey } from '../metric-keys';

export const MARKET_BENCHMARK_ENGINE_VERSION = '2.0.0';

/**
 * Validated minimum (item 15): tested with 10/20/30/50 real candidates
 * (market-benchmark.engine.spec.ts, describe "sensibilidade do mínimo"). 10 is
 * the classic floor below which a percentile's standard error stops being
 * controllable (the standard error of a proportion ~ 1/√n — with n=10, ±~16
 * percentage points of uncertainty is already large, but it is the smallest n
 * where "percentile" still has minimal statistical meaning). n>=30 is the classic
 * normal-approximation threshold — so SAMPLE_QUALITY uses 30 as the "HIGH"
 * reliability floor (see sampleQualityFor below), not as a computation minimum.
 * Keeping 10 as the COMPUTATION floor and using a separate quality indicator
 * (instead of simply raising the minimum) keeps more artists with a real result
 * while being honest about reliability.
 */
export const MINIMUM_COHORT_SIZE = 10;

/** A sample >= this is statistically more robust (classic normal approximation) — used only for the quality label, not a second computation minimum. */
export const HIGH_QUALITY_SAMPLE_SIZE = 30;

/**
 * Soundcharts call budget per cohort refresh (item 17): the UI NEVER queries
 * Soundcharts directly. A cold-cache benchmark computation makes at most
 * `MAX_CANDIDATES_PER_REFRESH * (BENCHMARK_METRICS.length + 1 country call)`
 * calls — for 20 candidates × 7 metrics = 140, a deliberate ceiling (DJ Stay has
 * 40 real related artists; 20 is already a large enough sample for
 * HIGH_QUALITY_SAMPLE_SIZE). Subsequent calls within the TTL reuse the cache
 * (market_reference_metrics), with no new call.
 */
export const MAX_CANDIDATES_PER_REFRESH = 20;

/**
 * Candidate metric fetch concurrency (Phase 3.2, item 11): 1 = strictly
 * sequential, never an unbounded `Promise.all`. A deliberately conservative
 * choice — without confirmation of the contracted Soundcharts plan's
 * rate-limit/concurrency (item 19: LICENSING_RETENTION_NOT_VERIFIED), the safest
 * option is the slowest one, not the fastest. Now that the refresh runs in the
 * background (it no longer blocks the HTTP request — Phase 3.2), the cost of
 * being sequential is no longer a latency problem the user notices.
 */
export const CANDIDATE_FETCH_CONCURRENCY = 1;

/**
 * REFERENCE CACHE TTL (per external candidate metric) — item 18. Deliberately
 * SEPARATE from the BENCHMARK SNAPSHOT TTL (BENCHMARK_SNAPSHOT_TTL_HOURS below,
 * item 13): the reference cache is granular per metric (one metric may be fresh
 * while another of the same candidate is stale); the snapshot is the
 * already-computed aggregate result, served by the fast read (getStatus) — the
 * two may diverge on purpose (e.g. a smaller snapshot TTL would force more
 * frequent recomputation even with a still-fresh reference cache).
 */
export const COHORT_CACHE_TTL_HOURS = 24;

/**
 * Persisted BENCHMARK SNAPSHOT TTL (item 13): past this, a read (`getStatus`)
 * still serves the last snapshot (stale-while-revalidate, item 6) but marks
 * `readStatus=STALE` and enqueues a background refresh.
 */
export const BENCHMARK_SNAPSHOT_TTL_HOURS = 24;

export type CohortFallbackLevel = 1 | 2;

/**
 * Deterministic fallback using ONLY confirmed real attributes (item 13):
 * related-artists is always the base (never purely genre/tenant standalone — we
 * have no reliable genre data for external candidates, see the audit in the
 * report). L1 narrows by country when the target artist itself has a known
 * country_code on Soundcharts; it falls back to L2 (all related artists, no
 * country filter) when L1 does not reach the minimum — it never falls back to
 * "the tenant's artists" (removed; it was this mission's conceptual defect).
 */
export const COHORT_FALLBACK_LEVELS: Array<{ level: CohortFallbackLevel; description: string }> = [
  { level: 1, description: 'artistas relacionados (Soundcharts /related) com o mesmo country_code do artista-alvo' },
  { level: 2, description: 'artistas relacionados (Soundcharts /related), sem filtro de país' },
];

/** Metrics compared in the benchmark — the same typed registry used by Career Stage/History. */
export const BENCHMARK_METRICS: MetricKey[] = [
  METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS,
  METRIC_KEYS.YOUTUBE_SUBSCRIBERS,
  METRIC_KEYS.DEEZER_FANS,
  METRIC_KEYS.SOUNDCLOUD_FOLLOWERS,
  METRIC_KEYS.INSTAGRAM_FOLLOWERS,
  METRIC_KEYS.TIKTOK_FOLLOWERS,
];

export interface BenchmarkLabelBand {
  min: number;
  max: number;
  label: string;
}

/** Aggregate percentile (0-100) → label, centralized config (item 34). */
export const BENCHMARK_LABELS: BenchmarkLabelBand[] = [
  { min: 0, max: 19, label: 'Abaixo da Média' },
  { min: 20, max: 44, label: 'Na Média' },
  { min: 45, max: 69, label: 'Acima da Média' },
  { min: 70, max: 89, label: 'Forte' },
  { min: 90, max: 100, label: 'Top Performer' },
];

export const STALE_AFTER_DAYS = 14;
