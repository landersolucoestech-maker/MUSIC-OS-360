/**
 * metrics/AdaptivePlatformMetrics.tsx
 *
 * Adaptive renderer: receives the platform and the available values, looks up
 * the capability registry and draws ONLY what that source really supports.
 *
 * It does not branch on `if (platform === ...)`: the difference between
 * platforms lives in the registry. Platforms with different schemas render
 * different sets without specific code.
 */

import {
  resolvePlatformMetrics,
  metricCapabilitiesOf,
  formatMetricValue,
  type PlatformMetricKey,
} from "./platform-metric-capabilities";

interface Props {
  platform: string;
  values: Partial<Record<PlatformMetricKey, number | null | undefined>>;
  /** Text shown when the source supports a metric but the value has not arrived yet. */
  unavailableLabel?: string;
  testIdPrefix?: string;
}

export function AdaptivePlatformMetrics({
  platform,
  values,
  unavailableLabel = "Indisponível",
  testIdPrefix = "metric",
}: Props) {
  const supported = metricCapabilitiesOf(platform);
  const resolved = resolvePlatformMetrics(platform, values);

  // The source provides no metric for this platform (e.g. Apple Music).
  // We invent neither a card nor "0"/"N/A" — we state what is true.
  if (supported.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground" data-testid={`${testIdPrefix}-${platform}-unsupported`}>
        Sem métrica de audiência nesta fonte
      </p>
    );
  }

  return (
    <div className="space-y-1" data-testid={`${testIdPrefix}-${platform}`}>
      {supported.map((d) => {
        const hit = resolved.find((r) => r.key === d.key);
        return (
          <div key={d.key} className="flex items-baseline gap-2">
            <span
              className="text-sm font-semibold text-foreground"
              data-testid={`${testIdPrefix}-${platform}-${d.key}`}
            >
              {/* A real `0` is data and is rendered; a missing value never becomes 0. */}
              {hit ? formatMetricValue(hit.value) : unavailableLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
