import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";

// Espelha MarketBenchmarkResult (apps/api/.../analytics/market-benchmark.engine.ts).
export type BenchmarkMetricStatus = "AVAILABLE" | "ARTIST_VALUE_UNAVAILABLE" | "INSUFFICIENT_COHORT";
export type SampleQuality = "HIGH" | "MEDIUM" | "INSUFFICIENT";

export interface BenchmarkMetricResult {
  metricKey: string;
  status: BenchmarkMetricStatus;
  artistValue: number | null;
  cohortMedian: number | null;
  percentile: number | null;
  sampleSize: number;
  sampleQuality: SampleQuality;
  source: "soundcharts";
}

export interface CohortDefinition {
  sourceArtistUuid: string | null;
  countryFilter: string | null;
  candidateCount: number;
}

export interface MarketBenchmarkResult {
  status: "OK" | "INSUFFICIENT_MARKET_DATA";
  score: number | null;
  label: string | null;
  cohortDefinition: CohortDefinition;
  sampleSize: number;
  fallbackLevel: 1 | 2;
  metrics: BenchmarkMetricResult[];
  engineVersion: string;
  calculatedAt: string;
}

// Phase 3.2 — reads are always fast (items 4/26): the external cohort refresh
// (up to ~65s of Soundcharts calls) runs in the background; the GET never waits
// for it. `readStatus` says what the UI must show; `result` is the last known
// computation (served even when STALE — stale-while-revalidate).
export type MarketBenchmarkReadStatus = "READY" | "STALE" | "REFRESHING" | "INTEGRATION_UNAVAILABLE" | "ERROR";

export interface MarketBenchmarkReadResult {
  readStatus: MarketBenchmarkReadStatus;
  result: MarketBenchmarkResult | null;
  staleSince: string | null;
}

export const marketBenchmarkKey = (artistId: string | null | undefined) => ["artists", artistId, "market-benchmark"];

/**
 * Phase 3.2 — Market Benchmark: fast read (never blocks on an external
 * refresh). While `readStatus` is REFRESHING, it polls briefly to pick up the
 * result as soon as the background worker finishes — without showing invented
 * progress (item 31), just re-querying.
 */
export function useMarketBenchmark(artistId: string | null | undefined) {
  return useQuery({
    queryKey: marketBenchmarkKey(artistId),
    queryFn: async () => {
      if (!artistId) return null;
      return api.get<MarketBenchmarkReadResult>(`/artists/${artistId}/market-benchmark`);
    },
    enabled: Boolean(artistId),
    staleTime: 5 * 60_000,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as MarketBenchmarkReadResult | null | undefined;
      return data?.readStatus === "REFRESHING" ? 5_000 : false;
    },
  });
}
