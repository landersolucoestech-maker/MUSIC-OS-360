import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeEvolutionSummary,
  type TrendDirection,
} from "./ArtistaEvolutionCard";
import type { MetricEvolutionPoint } from "@/hooks/useSpotify";

interface PlatformMiniTrendProps {
  points: MetricEvolutionPoint[] | undefined;
  metric?: "followers" | "views" | "popularity";
  /** Cor do traço da sparkline (CSS). Default: branco translúcido. */
  strokeColor?: string;
  /** Aparência do texto: tiles coloridos usam "white", neutros podem usar "muted". */
  variant?: "white" | "muted";
  /** Prefixo de data-testid para o badge/sparkline. */
  testIdPrefix: string;
  /**
   * Quando `true`, renderiza um placeholder discreto ("— sem histórico")
   * caso ainda não exista snapshot suficiente. Por padrão (`false`) o
   * componente não renderiza nada — adequado para os tiles grandes onde a
   * ausência da sparkline já transmite a ideia.
   */
  showEmptyState?: boolean;
  /** Quando `false`, oculta a sparkline mesmo havendo dados suficientes. */
  showSparkline?: boolean;
}

/**
 * Mini badge de tendência + sparkline para uso DENTRO dos tiles compactos
 * de `ArtistaPlatformMetrics`. Para o card grande da aba "Evolução" use
 * `ArtistaEvolutionCard`.
 *
 * Por padrão renderiza nada se não houver pelo menos 2 pontos com valor —
 * assim os tiles não ficam "ruidosos" enquanto o histórico é coletado.
 * Use `showEmptyState` para mostrar um placeholder "—" nos lugares onde a
 * ausência precisa ficar evidente (ex.: chips do dashboard 360).
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
              ? "bg-white/20 text-white/90"
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

  // Cores: em tiles coloridos preferimos contraste em branco/translúcido;
  // em tiles neutros usamos verde/vermelho/cinza padrão.
  const badgeClass = onColored
    ? "bg-white/20 text-white"
    : direction === "up"
    ? "bg-green-500/15 text-green-600 dark:text-green-400"
    : direction === "down"
    ? "bg-red-500/15 text-red-600 dark:text-red-400"
    : "bg-muted text-muted-foreground";

  const stroke =
    strokeColor ??
    (onColored
      ? "rgba(255,255,255,0.85)"
      : direction === "up"
      ? "rgb(22 163 74)"
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
