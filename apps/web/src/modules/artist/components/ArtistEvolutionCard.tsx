import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
export interface MetricEvolutionPoint { date?: string; captured_at?: string; value?: number; streams?: number; followers?: number; saves?: number; [key: string]: unknown; }

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return numberFormatter.format(value);
}

function formatPercent(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const abs = Math.abs(pct);
  const formatted = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return `${pct >= 0 ? "+" : "−"}${formatted}%`;
}

export type TrendDirection = "up" | "down" | "flat";

export interface EvolutionSummary {
  current: number | null;
  previous: number | null;
  delta: number | null;
  percent: number | null;
  direction: TrendDirection;
  hasEnoughData: boolean;
}

/**
 * Calcula a variação entre o snapshot mais recente e o mais antigo dentro
 * da janela. Retorna `hasEnoughData=false` quando não há ao menos 2 pontos
 * com valor numérico — nesse caso o card mostra "Sem histórico ainda".
 */
export function computeEvolutionSummary(
  points: MetricEvolutionPoint[] | undefined,
  metric: "followers" | "views" | "popularity",
): EvolutionSummary {
  const valid = (points ?? [])
    .map((p) => ({ ...p, value: p[metric] }))
    .filter((p): p is MetricEvolutionPoint & { value: number } =>
      typeof p.value === "number" && Number.isFinite(p.value),
    );
  if (valid.length === 0) {
    return {
      current: null,
      previous: null,
      delta: null,
      percent: null,
      direction: "flat",
      hasEnoughData: false,
    };
  }
  const current = valid[valid.length - 1].value;
  if (valid.length === 1) {
    return {
      current,
      previous: null,
      delta: null,
      percent: null,
      direction: "flat",
      hasEnoughData: false,
    };
  }
  const previous = valid[0].value;
  const delta = current - previous;
  const percent = previous === 0 ? null : (delta / previous) * 100;
  const direction: TrendDirection =
    delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return {
    current,
    previous,
    delta,
    percent,
    direction,
    hasEnoughData: true,
  };
}

interface ChartPoint {
  date: string;
  value: number;
  label: string;
}

interface ArtistEvolutionCardProps {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  /** Cor primária (formato hex) usada na linha/área e no acento de cabeçalho. */
  accent: string;
  isLoading: boolean;
  /** Quando ausência de configuração/ID, renderiza estado vazio amigável. */
  isMissingConfig?: boolean;
  missingConfigLabel?: string;
  /** Erro genérico vindo da query. */
  errorMessage?: string | null;
  points: MetricEvolutionPoint[] | undefined;
  metric: "followers" | "views" | "popularity";
  metricLabel: string;
  testIdPrefix: string;
}

const directionStyle: Record<
  TrendDirection,
  { className: string; Icon: LucideIcon; ariaLabel: string }
> = {
  up: {
    className: "bg-success/10 text-success border-success/30",
    Icon: ArrowUpRight,
    ariaLabel: "em crescimento",
  },
  down: {
    className: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: ArrowDownRight,
    ariaLabel: "em queda",
  },
  flat: {
    className: "bg-muted text-muted-foreground border-border",
    Icon: Minus,
    ariaLabel: "estável",
  },
};

export function ArtistEvolutionCard({
  title,
  subtitle,
  Icon,
  accent,
  isLoading,
  isMissingConfig,
  missingConfigLabel,
  errorMessage,
  points,
  metric,
  metricLabel,
  testIdPrefix,
}: ArtistEvolutionCardProps) {
  const summary = useMemo(() => computeEvolutionSummary(points, metric), [points, metric]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return (points ?? [])
      .filter((p): p is MetricEvolutionPoint & Record<typeof metric, number> =>
        typeof p[metric] === "number" && Number.isFinite(p[metric] as number),
      )
      .map((p) => {
        // O snapshot real do backend traz `captured_at`; aceitamos `date` por retrocompat.
        const rawDate = typeof p.captured_at === "string" ? p.captured_at : p.date;
        const dt = typeof rawDate === "string" ? parseISO(rawDate) : new Date(NaN);
        const hasValidDate = !Number.isNaN(dt.getTime());
        return {
          date: typeof rawDate === "string" ? rawDate : "",
          value: Number(p[metric]),
          // Sem data válida não inventamos um valor: o rótulo fica "—" (transparente).
          label: hasValidDate ? format(dt, "dd/MM", { locale: ptBR }) : "—",
        };
      });
  }, [points, metric]);

  const dirStyle = directionStyle[summary.direction];
  const DirectionIcon = dirStyle.Icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Cabeçalho */}
        <div
          className="flex items-center gap-3 border-b bg-card px-4 py-3"
        >
          <div
            className="h-9 w-9 rounded-lg grid place-items-center text-foreground shrink-0"
            style={{ backgroundColor: accent }}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
        </div>

        {/* Corpo */}
        <div className="px-4 py-4 space-y-3">
          {isMissingConfig ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {missingConfigLabel ?? "Plataforma não configurada para este artista."}
            </div>
          ) : isLoading ? (
            <>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : errorMessage ? (
            <div className="text-sm text-destructive">
              {errorMessage}
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <p
                    className="text-2xl font-bold leading-none"
                    data-testid={`${testIdPrefix}-current`}
                  >
                    {formatNumber(summary.current)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{metricLabel}</p>
                </div>

                {summary.hasEnoughData && summary.percent !== null ? (
                  <div className="flex flex-col items-end">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                        dirStyle.className,
                      )}
                      data-testid={`${testIdPrefix}-trend`}
                      aria-label={`Métrica ${dirStyle.ariaLabel}`}
                    >
                      <DirectionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span data-testid={`${testIdPrefix}-percent`}>
                        {formatPercent(summary.percent)}
                      </span>
                    </span>
                    {summary.delta !== null ? (
                      <span
                        className="text-[11px] text-muted-foreground mt-1"
                        data-testid={`${testIdPrefix}-delta`}
                      >
                        {summary.delta >= 0 ? "+" : "−"}
                        {formatNumber(Math.abs(summary.delta))} no período
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span
                    className="text-xs text-muted-foreground italic"
                    data-testid={`${testIdPrefix}-empty`}
                  >
                    Sem histórico suficiente ainda
                  </span>
                )}
              </div>

              {chartData.length >= 2 ? (
                <div className="h-28 -mx-1" data-testid={`${testIdPrefix}-chart`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={20}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickFormatter={(v) =>
                          typeof v === "number" ? formatNumber(v) : String(v)
                        }
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(v: number) => [formatNumber(v), metricLabel]}
                        labelFormatter={(l) => `Data: ${l}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={accent}
                        strokeWidth={2}
                        fill={accent}
                        fillOpacity={0.12}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

