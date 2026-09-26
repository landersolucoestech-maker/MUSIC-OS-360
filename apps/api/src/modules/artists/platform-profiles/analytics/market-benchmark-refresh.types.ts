/**
 * analytics/market-benchmark-refresh.types.ts
 *
 * Phase 3.2 — payload of the Market Benchmark background refresh job.
 * Item 27: safe identifiers only — no token/secret/credential.
 */
export interface MarketBenchmarkRefreshJobPayload {
  tenant_id: string;
  artist_id: string;
  target_uuid: string;
  engine_version: string;
  reason: 'cold' | 'stale' | 'manual';
  idempotency_key: string;
}

/** Observable job result (item 28), written to the logs — not persisted in its own table (reuses the already-persisted snapshot + structured logs). */
export interface MarketBenchmarkRefreshJobResult {
  status: 'OK' | 'INSUFFICIENT_MARKET_DATA';
  candidateCount: number;
  metricRequestCount: number;
  cacheHits: number;
  cacheMisses: number;
  fallbackLevel: 1 | 2;
  durationMs: number;
}
