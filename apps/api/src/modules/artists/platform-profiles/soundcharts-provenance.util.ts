/**
 * platform-profiles/soundcharts-provenance.util.ts
 *
 * Mandatory per-metric traceability (2026-08-31 audit): for
 * any displayed number it must be possible to determine where it came from —
 * provider, platform, exact endpoint, exact response body field,
 * when it was fetched, raw value and normalized value. A single builder
 * avoids duplicating these six keys in each of the 7 providers.
 */
import type { SoundchartsMetric } from '../../integrations/soundcharts/soundcharts.types';
import type { SocialPlatform } from './social-platform-sync.types';
import type { CrossPlatformEvidence, CrossPlatformStatus } from './soundcharts-canonical-candidates.util';

export interface SoundchartsProvenance {
  source_provider: 'soundcharts';
  source_platform: SocialPlatform;
  source_endpoint: string;
  source_field: string;
  fetched_at: string;
  normalized_at: string;
  raw_value: number;
  normalized_value: number;
  /**
   * Phase 2 — full dated series (ISO) from the same endpoint, when
   * Soundcharts returned it (see SoundchartsMetric.series). Consumed by the
   * snapshot store to backfill real history without an extra API call;
   * no current-state consumer reads this field.
   */
  metric_series: Array<{ value: number; observed_at: string }>;
}

/** Provenance for a metric actually obtained from Soundcharts. */
export function soundchartsProvenance(platform: SocialPlatform, metric: SoundchartsMetric): SoundchartsProvenance {
  const normalizedAt = new Date().toISOString();
  return {
    source_provider: 'soundcharts',
    source_platform: platform,
    source_endpoint: metric.endpoint,
    source_field: metric.field,
    fetched_at: metric.observedAt.toISOString(),
    normalized_at: normalizedAt,
    raw_value: metric.value,
    normalized_value: metric.value,
    metric_series: (metric.series ?? []).map((p) => ({ value: p.value, observed_at: p.observedAt.toISOString() })),
  };
}

/**
 * Provenance for the "account not indexed in Soundcharts" case — no metric,
 * but still with a traceable origin (which endpoint answered "not found",
 * and when). Avoids an empty raw_payload when followers/subscribers stay null.
 */
export function soundchartsNotIndexedProvenance(
  platform: SocialPlatform,
  attemptedEndpoints: string[],
): Omit<SoundchartsProvenance, 'raw_value' | 'normalized_value'> & { raw_value: null; normalized_value: null } {
  const now = new Date().toISOString();
  return {
    source_provider: 'soundcharts',
    source_platform: platform,
    source_endpoint: attemptedEndpoints.join(' ; '),
    source_field: 'items[] (empty — SoundchartsNotFoundError)',
    fetched_at: now,
    normalized_at: now,
    raw_value: null,
    normalized_value: null,
    metric_series: [],
  };
}

/**
 * Primary + cross-platform identity evidence for a metric of one of the
 * 4 anchors (spotify/youtube/deezer/soundcloud) — Phase 1.3: the registered
 * link is the authority; the exact per-platform resolution of the registered
 * identifier already IS the primary identity proof (`VERIFIED_EXACT`).
 * Cross-platform divergence is always diagnostic, never blocks.
 */
export interface PrimaryIdentityProvenance {
  primary_identity_status: 'VERIFIED_EXACT';
  cross_platform_status: CrossPlatformStatus;
  cross_platform_uuid: string | null;
  cross_platform_registry_identifier: string | null;
}

export function primaryIdentityProvenance(evidence: CrossPlatformEvidence): PrimaryIdentityProvenance {
  return {
    primary_identity_status: 'VERIFIED_EXACT',
    cross_platform_status: evidence.status,
    cross_platform_uuid: evidence.independentUuid,
    cross_platform_registry_identifier: evidence.registryIdentifier,
  };
}
