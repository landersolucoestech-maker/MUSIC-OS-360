/**
 * modules/integrations/soundcharts/soundcharts.types.ts
 *
 * Normalized output contract — it is not the ArtistPlatformProfile schema
 * (that integration happens at a later stage). Isolated here so the
 * SoundchartsService metric methods always return the same shape,
 * regardless of the raw format of each Soundcharts endpoint.
 */
export interface SoundchartsMetric {
  value: number;
  observedAt: Date;
  source: 'soundcharts';
  /** Caminho exato do endpoint Soundcharts que produziu `value` (provenance). */
  endpoint: string;
  /** Exact response body field `value` was read from (provenance). */
  field: string;
  /**
   * Phase 2 — full series of dated points the same endpoint already
   * returned (Soundcharts answers ~15 historical points per
   * audience/streaming/playlist call; previously discarded by pickLatest). Additive
   * and optional: no existing consumer reads this field, so filling it
   * does not change `.value`/`.observedAt`/`.source`/`.endpoint`/`.field` for
   * any provider — used only by the snapshot store for a real backfill without
   * an extra API call.
   */
  series?: Array<{ value: number; observedAt: Date }>;
}
