import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  computeEvolutionSummary,
  type TrendDirection,
} from "@/modules/artist/components/ArtistEvolutionCard";
interface MetricEvolutionPoint { date: string; value?: number; [key: string]: unknown; }

interface PlatformMiniTrendProps {
  points: MetricEvolutionPoint[] | undefined;
  metric?: "followers" | "views" | "popularity";
  /** Sparkline stroke color (CSS). Default: translucent white. */
  strokeColor?: string;
  /** Text contrast: colored tiles use "white", neutral ones may use "muted". */
  variant?: "white" | "muted";
  /** data-testid prefix for the badge/sparkline. */
  testIdPrefix: string;
  /**
   * When `true`, renders a discreet placeholder ("— sem histórico") when there
   * are not enough snapshots yet. By default (`false`) the component renders
   * nothing — suitable for the large tiles, where the missing sparkline already
   * conveys the idea.
   */
  showEmptyState?: boolean;
  /** When `false`, hides the sparkline even with enough data. */
  showSparkline?: boolean;
}

/**
 * Mini trend badge + sparkline for use INSIDE the compact `ArtistPlatformMetrics`
 * tiles. For the large card of the "Evolução" tab use `ArtistEvolutionCard`.
 *
 * By default it renders nothing unless there are at least 2 points with a value —
 * so the tiles are not "noisy" while history is collected. Use `showEmptyState`
 * to show a "—" placeholder where the absence must be evident (e.g. the 360
 * dashboard chips).
 */
export function PlatformMiniTrend({
  points,
  metric = "followers",
  strokeColor,
  variant = "white",
  testIdPrefix,
  showEmptyState = false,
  showSparkline = true,
}: PlatformMiniTrendProps) {
  const summary = useMemo(
    () => computeEvolutionSummary(points, metric),
    [points, metric],
  );

  const series = useMemo(() => {
    return (points ?? [])
      .map((p) => p[metric])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  }, [points, metric]);

  const onColored = variant === "white";

  if (!summary.hasEnoughData || summary.percent === null) {
    if (!showEmptyState) return null;
    return (
      <div
        className="mt-2 flex items-center gap-2"
        data-testid={`${testIdPrefix}-trend-row`}
      >
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium italic",
            onColored
              ? "bg-muted text-muted-foreground"
              : "bg-muted text-muted-foreground",
          )}
          aria-label="sem histórico ainda"
          data-testid={`${testIdPrefix}-trend-empty`}
        >
          — sem histórico
        </span>
      </div>
    );
  }

  const direction: TrendDirection = summary.direction;
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  // Colors: on colored tiles we prefer white/translucent contrast; on neutral
  // tiles we use the standard green/red/gray.
  const badgeClass = onColored
    ? "bg-muted text-foreground"
    : direction === "up"
    ? "bg-success/15 text-success"
    : direction === "down"
    ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";

  const stroke =
    strokeColor ??
    (onColored
      ? "rgba(255,255,255,0.85)"
      : direction === "up"
      ? "rgb(22 163 74)"
      /* intentional: SVG sparkline stroke must use a literal RGB — CSS var is not valid in SVG stroke attribute */
      : direction === "down"
      ? "rgb(220 38 38)"
      : "rgb(120 120 120)");

  const pct = summary.percent;
  const abs = Math.abs(pct);
  const pctLabel = `${pct >= 0 ? "+" : "−"}${abs >= 10 ? abs.toFixed(0) : abs.toFixed(1)}%`;

  return (
    <div
      className="mt-2 flex items-center gap-2"
      data-testid={`${testIdPrefix}-trend-row`}
    >
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          badgeClass,
        )}
        aria-label={
          direction === "up"
            ? "em crescimento"
            : direction === "down"
            ? "em queda"
            : "estável"
        }
        data-testid={`${testIdPrefix}-trend-badge`}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span data-testid={`${testIdPrefix}-trend-pct`}>{pctLabel}</span>
      </span>
      {showSparkline && series.length >= 2 ? (
        <Sparkline
          data={series}
          stroke={stroke}
          width={56}
          height={18}
          testId={`${testIdPrefix}-sparkline`}
        />
      ) : null}
    </div>
  );
}

interface SparklineProps {
  data: number[];
  width: number;
  height: number;
  stroke: string;
  testId: string;
}

function Sparkline({ data, width, height, stroke, testId }: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      data-testid={testId}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

