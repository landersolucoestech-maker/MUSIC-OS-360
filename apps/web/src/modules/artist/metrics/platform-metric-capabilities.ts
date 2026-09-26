/**
 * metrics/platform-metric-capabilities.ts
 *
 * SUBCLUSTER D — central registry of metric CAPABILITIES per platform.
 *
 * Describes STRUCTURE, never data: which metrics the current source really
 * provides for each platform, with which label, semantic group and visual
 * priority. Removes the false assumption that every platform has the same
 * schema.
 *
 * SOURCE OF TRUTH: the real providers in
 * apps/api/src/modules/artists/platform-profiles/providers/*.ts, which today fill
 * exactly these fields (the rest stays `null`):
 *
 *   spotify      → monthly_listeners   (followers/subscribers null)
 *   youtube      → subscribers         (followers/monthly_listeners null)
 *   soundcloud   → followers
 *   deezer       → followers           (Deezer API fans)
 *   instagram    → followers
 *   tiktok       → followers
 *   apple_music  → NONE                (all three fields are null)
 *
 * Apple Music has no metric entry on purpose: Soundcharts does not expose an
 * Apple Music audience in the current flow. Inventing "Ouvintes: 0" or
 * "Ouvintes: N/A" just because other platforms have listeners would fabricate
 * information.
 */

/** Metric keys the backend really delivers. */
export type PlatformMetricKey = "monthly_listeners" | "followers" | "subscribers";

/**
 * Desired semantic order when matching data exists:
 * consumption → audience → reach → engagement → followers.
 */
export type MetricSemanticGroup =
  | "consumption" | "audience" | "reach" | "engagement" | "followers";

export interface PlatformMetricDefinition {
  key: PlatformMetricKey;
  label: string;
  semanticGroup: MetricSemanticGroup;
  /** Lower = more important. Derived from the semantic group. */
  priority: number;
}

const SEMANTIC_PRIORITY: Record<MetricSemanticGroup, number> = {
  consumption: 10,
  audience: 20,
  reach: 30,
  engagement: 40,
  followers: 50,
};

const def = (
  key: PlatformMetricKey, label: string, semanticGroup: MetricSemanticGroup,
): PlatformMetricDefinition => ({
  key, label, semanticGroup, priority: SEMANTIC_PRIORITY[semanticGroup],
});

/**
 * Capabilities per platform. An EMPTY list is a legitimate statement:
 * "this source provides no audience metric for this platform".
 */
export const PLATFORM_METRIC_CAPABILITIES: Record<string, readonly PlatformMetricDefinition[]> = {
  spotify:     [def("monthly_listeners", "Ouvintes mensais", "audience")],
  youtube:     [def("subscribers", "Inscritos", "followers")],
  soundcloud:  [def("followers", "Seguidores", "followers")],
  deezer:      [def("followers", "Fãs", "followers")],
  instagram:   [def("followers", "Seguidores", "followers")],
  tiktok:      [def("followers", "Seguidores", "followers")],
  // No audience metric in the current source — see the header.
  apple_music: [],
};

/** Accepts both slug formats used in the project (apple-music / apple_music). */
function normalize(platform: string): string {
  return platform.trim().toLowerCase().replace(/-/g, "_");
}

export function metricCapabilitiesOf(platform: string): readonly PlatformMetricDefinition[] {
  return PLATFORM_METRIC_CAPABILITIES[normalize(platform)] ?? [];
}

export interface ResolvedMetric extends PlatformMetricDefinition {
  value: number;
}

/**
 * Resolves what the UI must render for a platform.
 *
 * Rules this resolver exists to guarantee:
 *   - a metric NOT supported by the source never appears, even if a value comes;
 *   - a supported but missing metric (null/undefined) does NOT become a fabricated 0;
 *   - a real `0` is data and is still rendered;
 *   - ordering by semantic priority, not arrival order.
 */
export function resolvePlatformMetrics(
  platform: string,
  values: Partial<Record<PlatformMetricKey, number | null | undefined>>,
): ResolvedMetric[] {
  return metricCapabilitiesOf(platform)
    .filter((d) => typeof values[d.key] === "number" && Number.isFinite(values[d.key] as number))
    .map((d) => ({ ...d, value: values[d.key] as number }))
    .sort((a, b) => a.priority - b.priority);
}

/** Compact pt-BR formatting, used by every platform. */
export function formatMetricValue(value: number): string {
  return value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
}

export interface PrimaryMetric {
  key: PlatformMetricKey;
  label: string;
  value: number | null;
}

/**
 * A platform's main metric: the one with the HIGHEST semantic priority the
 * source really supports. `value: null` = supported but missing (never a
 * fabricated 0). Returns null when the source provides no metric at all.
 */
export function primaryMetricFor(
  platform: string,
  snapshot: Partial<Record<PlatformMetricKey, number | null | undefined>> | null | undefined,
): PrimaryMetric | null {
  const [def] = [...metricCapabilitiesOf(platform)].sort((a, b) => a.priority - b.priority);
  if (!def) return null;
  const v = snapshot?.[def.key];
  const value = typeof v === "number" && Number.isFinite(v) ? v : null;
  return { key: def.key, label: def.label, value };
}
