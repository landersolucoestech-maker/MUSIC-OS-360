import { useMemo, type ComponentType } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe2,
  TrendingUp,
} from "lucide-react";
import {
  SiGoogleads,
  SiInstagram,
  SiSpotify,
  SiTiktok,
  SiYoutube,
} from "react-icons/si";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { MainLayout } from "@/shared/components/MainLayout";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { MarketingHeader, MarketingSectionCard } from "../components";
import { useCentralAnaliticaMarketing } from "../hooks/useCentralAnaliticaMarketing";
import { useReleases } from "@/modules/releases/hooks/useReleases";
import { formatCompact, formatPercent } from "../utils/marketing-format";
import { formatMetric, PLATFORM_META } from "../analytics/central-analitica.format";
import type {
  ContentPerformance,
  PlatformBlock,
  PlatformId,
  PlatformMetric,
  TrendPoint,
} from "../analytics/central-analitica.types";

type ExportFormat = "pdf" | "xlsx";

type PlatformTab = {
  id: PlatformId;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type SummaryItem = {
  id: string;
  label: string;
  value: string;
};

type KpiItem = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

const PLATFORM_TABS: PlatformTab[] = [
  { id: "overview", label: "Visão Geral", icon: Globe2 },
  { id: "youtube", label: "YouTube", icon: SiYoutube },
  { id: "tiktok", label: "TikTok", icon: SiTiktok },
  { id: "instagram", label: "Instagram", icon: SiInstagram },
  { id: "google", label: "Google Ads", icon: SiGoogleads },
  { id: "spotify", label: "Spotify Ads", icon: SiSpotify },
];

const PLATFORM_ACCENT: Record<PlatformId, string> = {
  overview: "text-primary",
  youtube: "text-red-500",
  tiktok: "text-foreground",
  instagram: "text-pink-500",
  google: "text-blue-500",
  spotify: "text-emerald-500",
};

const PLATFORM_MULTIPLIER: Record<PlatformId, number> = {
  overview: 1,
  youtube: 0.42,
  tiktok: 0.54,
  instagram: 0.38,
  google: 0.26,
  spotify: 0.31,
};

const PLATFORM_KPI_IDS: Record<Exclude<PlatformId, "overview">, string[]> = {
  youtube: ["yt-views", "yt-subs", "yt-likes", "yt-comments", "yt-shares", "yt-retention"],
  tiktok: ["tt-views", "tt-reach", "tt-engrate", "tt-growth", "tt-shares", "tt-audio"],
  instagram: ["ig-reach", "ig-impressions", "ig-followers", "ig-likes", "ig-reels", "ig-posts"],
  google: ["gg-ads-spend", "gg-impressions", "gg-ads-clicks", "gg-ads-ctr", "gg-ads-cpa", "gg-ads-conv", "gg-ads-roas"],
  spotify: ["sp-ads-spend", "sp-ads-imp", "sp-ads-clicks", "sp-streams", "sp-saves", "sp-followers"],
};

const PLATFORM_SUMMARY_IDS: Record<Exclude<PlatformId, "overview">, string[]> = {
  youtube: ["yt-impressions", "yt-watch", "yt-ctr", "yt-ads-spend", "yt-ads-conv"],
  tiktok: ["tt-followers", "tt-plays", "tt-comments", "tt-ads-spend", "tt-ads-conv"],
  instagram: ["ig-saves", "ig-shares", "ig-clicks", "ig-ads-spend", "ig-ads-conv"],
  google: ["gg-clicks", "gg-queries", "gg-ads-spend", "gg-ads-conv", "gg-ads-roas"],
  spotify: ["sp-listeners", "sp-playlists", "sp-ads-spend", "sp-ads-clicks", "sp-revenue"],
};

function flattenPlatformMetrics(block: PlatformBlock | null | undefined): PlatformMetric[] {
  return block?.groups.flatMap((group) => group.metrics) ?? [];
}

function metricById(metrics: PlatformMetric[], id: string) {
  return metrics.find((metric) => metric.id === id);
}

function formatPlatformMetric(metric: PlatformMetric | undefined) {
  return metric ? formatMetric(metric.value, metric.format) : "—";
}

function sumPaidMetric(platforms: PlatformBlock[], matcher: (metric: PlatformMetric) => boolean) {
  return platforms.reduce((total, platform) => {
    const paid = platform.groups.filter((group) => group.layer === "paid").flatMap((group) => group.metrics);
    return total + paid.reduce((sum, metric) => sum + (matcher(metric) && typeof metric.value === "number" ? metric.value : 0), 0);
  }, 0);
}

function buildOverviewSummary(ctrl: ReturnType<typeof useCentralAnaliticaMarketing>, content: ContentPerformance[] = ctrl.content): SummaryItem[] {
  const kpis = new Map(ctrl.executiveKpis.map((kpi) => [kpi.id, kpi]));
  const reach = kpis.get("reach")?.value ?? 0;
  const impressions = kpis.get("impressions")?.value ?? 0;
  const clicks = kpis.get("clicks")?.value ?? 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const adsImpressions = sumPaidMetric(ctrl.platforms, (metric) => /imp|impress/i.test(metric.id) || /impress/i.test(metric.label));
  const bestContent = content[0];

  return [
    { id: "audience", label: "Audiência total", value: formatMetric(kpis.get("audience")?.value, "compact") },
    { id: "views", label: "Views totais/mês", value: formatMetric(kpis.get("views")?.value, "compact") },
    { id: "engagement", label: "Engajamento médio", value: formatMetric(kpis.get("engagement")?.value, "compact") },
    { id: "reach", label: "Alcance total", value: formatCompact(reach) },
    { id: "ads-impressions", label: "Impressões Ads", value: formatCompact(adsImpressions) },
    { id: "clicks", label: "Cliques totais", value: formatMetric(clicks, "compact") },
    { id: "ctr", label: "CTR médio", value: ctr === null ? "—" : formatPercent(ctr) },
    { id: "conversions", label: "Conversões totais", value: formatMetric(kpis.get("conversions")?.value, "integer") },
    { id: "investment", label: "Investimento total", value: formatMetric(kpis.get("investment")?.value, "currency") },
    { id: "best-content", label: "Melhor conteúdo", value: bestContent?.title ?? "—" },
  ];
}

function buildOverviewKpis(ctrl: ReturnType<typeof useCentralAnaliticaMarketing>): KpiItem[] {
  const kpis = new Map(ctrl.executiveKpis.map((kpi) => [kpi.id, kpi]));
  return ["reach", "views", "audience", "clicks", "conversions", "investment"].map((id) => {
    const kpi = kpis.get(id);
    return {
      id,
      label: kpi?.label ?? id,
      value: formatMetric(kpi?.value, kpi?.format ?? "compact"),
    };
  });
}

function buildPlatformKpis(block: PlatformBlock | null): KpiItem[] {
  if (!block || block.id === "overview") return [];
  const metrics = flattenPlatformMetrics(block);
  return PLATFORM_KPI_IDS[block.id].map((id) => {
    const metric = metricById(metrics, id);
    return {
      id,
      label: metric?.label ?? id,
      value: formatPlatformMetric(metric),
    };
  });
}

function buildPlatformSummary(block: PlatformBlock | null, ranking: ContentPerformance[]): SummaryItem[] {
  if (!block || block.id === "overview") return [];
  const metrics = flattenPlatformMetrics(block);
  const ids = PLATFORM_SUMMARY_IDS[block.id];
  const best = ranking[0];
  return [
    ...ids.map((id) => {
      const metric = metricById(metrics, id);
      return { id, label: metric?.label ?? id, value: formatPlatformMetric(metric) };
    }),
    { id: "top-content", label: "Melhor conteúdo", value: best?.title ?? "—" },
  ];
}

function buildPlatformTrend(data: TrendPoint[], platform: PlatformId): TrendPoint[] {
  const multiplier = PLATFORM_MULTIPLIER[platform];
  return data.map((point) => ({
    label: point.label,
    reach: Math.round(point.reach * multiplier),
    engagement: Math.round(point.engagement * multiplier),
    conversions: Math.round(point.conversions * multiplier),
    streams: Math.round(point.streams * multiplier),
  }));
}

function getTrendMetric(platform: PlatformId): keyof TrendPoint {
  if (platform === "spotify") return "streams";
  if (platform === "google") return "conversions";
  return "reach";
}

function getTrendLabel(platform: PlatformId) {
  if (platform === "spotify") return "Streams atribuídos";
  if (platform === "google") return "Conversões";
  if (platform === "overview") return "Evolução consolidada";
  return "Evolução da plataforma";
}

function contentReleaseId(item: ContentPerformance): string | null {
  const record = item as unknown as Record<string, unknown>;
  const releaseId = record["releaseId"] ?? record["release_id"];
  return typeof releaseId === "string" ? releaseId : null;
}

function getPlatformBlock(platforms: PlatformBlock[], id: PlatformId) {
  return platforms.find((platform) => platform.id === id) ?? null;
}

function handleExport(format: ExportFormat) {
  // Technical TODO: wire this handler to the real PDF/XLSX export endpoint once the API is available.
  toast.info(`Exportação ${format.toUpperCase()} ainda não implementada. Nenhum arquivo foi gerado.`);
}

export default function Metricas() {
  const ctrl = useCentralAnaliticaMarketing();
  const [searchParams] = useSearchParams();
  const releaseId = searchParams.get("releaseId");
  const { lancamentos } = useReleases();
  const selectedRelease = useMemo(
    () => (releaseId ? lancamentos.find((release) => release.id === releaseId) ?? null : null),
    [lancamentos, releaseId],
  );
  const releaseContent = useMemo(() => {
    if (!releaseId) return ctrl.content;
    const linkedContent = ctrl.content.filter((item) => contentReleaseId(item) === releaseId);
    return linkedContent.length > 0 ? linkedContent : ctrl.content;
  }, [ctrl.content, releaseId]);
  const activePlatform = ctrl.platform;
  const activeBlock = useMemo(
    () => getPlatformBlock(ctrl.platforms, activePlatform),
    [ctrl.platforms, activePlatform],
  );
  const scopedContent = useMemo(
    () => (activePlatform === "overview" ? releaseContent : releaseContent.filter((item) => item.platform === activePlatform)),
    [releaseContent, activePlatform],
  );
  const trend = useMemo(
    () => buildPlatformTrend(ctrl.trend, activePlatform),
    [ctrl.trend, activePlatform],
  );
  const overviewSummary = useMemo(() => buildOverviewSummary(ctrl, releaseContent), [ctrl, releaseContent]);
  const overviewKpis = useMemo(() => buildOverviewKpis(ctrl), [ctrl]);
  const platformKpis = useMemo(() => buildPlatformKpis(activeBlock), [activeBlock]);
  const platformSummary = useMemo(
    () => buildPlatformSummary(activeBlock, scopedContent),
    [activeBlock, scopedContent],
  );

  const summary = activePlatform === "overview" ? overviewSummary : platformSummary;
  const kpis = activePlatform === "overview" ? overviewKpis : platformKpis;

  return (
    <FeatureGate feature="moduleMarketing" featureName="Marketing">
      <MainLayout title="Métricas" description="Performance de marketing por plataforma">
        <div className="space-y-6">
          {releaseId && (
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Release selecionado</Badge>
                <span className="font-medium text-foreground">
                  {selectedRelease?.title ?? "Lançamento não encontrado"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedRelease
                  ? "Métricas contextualizadas para este lançamento quando houver dados vinculados."
                  : "O release informado não foi encontrado; exibindo métricas gerais."}
              </p>
            </div>
          )}

          {ctrl.isError ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Não foi possível carregar as métricas.
                {ctrl.error instanceof Error ? ` (${ctrl.error.message})` : ""}
              </span>
            </div>
          ) : (
            <>
              <PlatformTabs value={activePlatform} onChange={ctrl.setPlatform} />

              <KpiStrip items={kpis} isLoading={ctrl.isLoading} />

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <PerformanceChart
                  title={activePlatform === "overview" ? "Evolução consolidada" : `${tabLabel(activePlatform)} · evolução`}
                  description={activePlatform === "overview" ? "Performance agregada das plataformas monitoradas" : "Série simulada da plataforma selecionada"}
                  data={trend}
                  metric={getTrendMetric(activePlatform)}
                  metricLabel={getTrendLabel(activePlatform)}
                  isLoading={ctrl.isLoading}
                  platform={activePlatform}
                />

                <SummaryPanel
                  title={activePlatform === "overview" ? "Resumo consolidado" : `Resumo · ${tabLabel(activePlatform)}`}
                  items={summary}
                  isLoading={ctrl.isLoading}
                />
              </div>

              <RankingPanel
                title={activePlatform === "overview" ? "Top Conteúdos" : `Ranking · ${tabLabel(activePlatform)}`}
                items={scopedContent}
                isLoading={ctrl.isLoading}
              />
            </>
          )}
        </div>
      </MainLayout>
    </FeatureGate>
  );
}

function ExportDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Exportar
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="mr-2 h-4 w-4" /> Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar XLSX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


function PlatformTabs({ value, onChange }: { value: PlatformId; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
      {PLATFORM_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", !active && PLATFORM_ACCENT[tab.id])} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function KpiStrip({ items, isLoading }: { items: KpiItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {["kpi-skeleton-1", "kpi-skeleton-2", "kpi-skeleton-3", "kpi-skeleton-4", "kpi-skeleton-5", "kpi-skeleton-6"].map((id) => (
          <Skeleton key={id} className="h-24" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState message="Sem KPIs disponíveis para esta plataforma." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-4">
          <p className="text-[11px] font-medium  tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{item.value}</p>
          {item.hint && <p className="mt-1 text-[10px]  tracking-wide text-amber-600">{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function PerformanceChart({
  title,
  description,
  data,
  metric,
  metricLabel,
  isLoading,
  platform,
}: {
  title: string;
  description: string;
  data: TrendPoint[];
  metric: keyof TrendPoint;
  metricLabel: string;
  isLoading: boolean;
  platform: PlatformId;
}) {
  const color = chartColor(platform);

  return (
    <MarketingSectionCard title={title} description={description} icon={TrendingUp} contentClassName="pt-0">
      {isLoading ? (
        <Skeleton className="h-[340px] w-full" />
      ) : data.length < 2 ? (
        <EmptyState message="Sem dados suficientes para exibir evolução no período." className="h-[340px]" />
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
                tickFormatter={(value: number) => formatCompact(value)}
                width={54}
              />
              <Tooltip
                formatter={(value) => [formatCompact(Number(value)), metricLabel]}
                labelClassName="text-foreground"
                contentStyle={{ borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                name={metricLabel}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.12}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </MarketingSectionCard>
  );
}

function SummaryPanel({ title, items, isLoading }: { title: string; items: SummaryItem[]; isLoading: boolean }) {
  return (
    <MarketingSectionCard title={title} description="Leitura rápida dos principais indicadores" icon={BarChart3}>
      {isLoading ? (
        <div className="space-y-2">
          {["summary-1", "summary-2", "summary-3", "summary-4", "summary-5"].map((id) => (
            <Skeleton key={id} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState message="Sem resumo disponível." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/35 px-3 py-2">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="max-w-[180px] text-right text-xs font-semibold leading-relaxed">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </MarketingSectionCard>
  );
}

function RankingPanel({ title, items, isLoading }: { title: string; items: ContentPerformance[]; isLoading: boolean }) {
  return (
    <MarketingSectionCard title={title} description="Ranking de performance por conteúdo, artista/campanha e plataforma" icon={BarChart3}>
      {isLoading ? (
        <div className="space-y-2">
          {["rank-1", "rank-2", "rank-3", "rank-4"].map((id) => (
            <Skeleton key={id} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState message="Nenhum conteúdo encontrado para esta plataforma." />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[60px_1.4fr_1fr_120px_130px] gap-3 px-3 text-[11px] font-semibold  tracking-wide text-muted-foreground lg:grid">
            <span>Posição</span>
            <span>Conteúdo</span>
            <span>Artista/Campanha</span>
            <span>Resultado</span>
            <span>Plataforma</span>
          </div>
          {items.map((item, index) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-lg border border-border bg-card p-3 lg:grid-cols-[60px_1.4fr_1fr_120px_130px] lg:items-center"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">{item.contentType}</p>
              </div>
              <p className="text-sm text-muted-foreground">{item.artist}</p>
              <div>
                <p className="text-sm font-semibold tabular-nums">{formatMetric(item.metricValue, item.metricFormat)}</p>
                <p className="text-[11px] text-muted-foreground">{item.metricLabel}</p>
              </div>
              <PlatformIndicator platform={item.platform} />
            </div>
          ))}
        </div>
      )}
    </MarketingSectionCard>
  );
}

function PlatformIndicator({ platform }: { platform: PlatformId }) {
  const meta = PLATFORM_META[platform];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <Icon className={cn("h-4 w-4", PLATFORM_ACCENT[platform])} />
      {tabLabel(platform)}
    </span>
  );
}

function EmptyState({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground", className)}>
      {message}
    </div>
  );
}

function tabLabel(platform: PlatformId) {
  return PLATFORM_TABS.find((tab) => tab.id === platform)?.label ?? PLATFORM_META[platform].label;
}

function chartColor(platform: PlatformId) {
  switch (platform) {
    case "youtube":
      return "#ef4444";
    case "tiktok":
      return "#a855f7";
    case "instagram":
      return "#ec4899";
    case "google":
      return "#3b82f6";
    case "spotify":
      return "#22c55e";
    default:
      return "#6366f1";
  }
}

