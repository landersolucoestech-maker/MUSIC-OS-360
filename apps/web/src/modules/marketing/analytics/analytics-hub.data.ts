import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_TYPE_LABEL,
  CONTENT_CHANNEL_LABEL,
} from "../constants/marketing.constants";
import { formatDate } from "../utils/marketing-format";
import type { AnalyticsOverview, MarketingCampaign } from "../types/marketing.types";
import type {
  BreakdownDimension,
  BreakdownRow,
  CampaignPerformanceVM,
  AnalyticsHubModel,
  ContentPerformance,
  MetricCardVM,
  PlatformBlock,
  PlatformId,
  TrendPoint,
} from "./analytics-hub.types";

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function platformId(value: string): PlatformId | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("youtube")) return "youtube";
  if (normalized.includes("tiktok")) return "tiktok";
  if (normalized.includes("instagram") || normalized.includes("meta")) return "instagram";
  if (normalized.includes("spotify")) return "spotify";
  if (normalized.includes("google")) return "google";
  return null;
}

function toCampaignVM(campaign: MarketingCampaign): CampaignPerformanceVM {
  const investment = campaign.budget ?? 0;
  const revenue = investment > 0 && campaign.metrics.roi
    ? investment + investment * campaign.metrics.roi
    : 0;
  return {
    id: campaign.id,
    name: campaign.name,
    type: CAMPAIGN_TYPE_LABEL[campaign.type] ?? campaign.type,
    status: CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status,
    owner: campaign.owner,
    platform: campaign.platforms.map((item) => CONTENT_CHANNEL_LABEL[item] ?? item).join(", ") || "—",
    reach: campaign.metrics.reach,
    impressions: campaign.metrics.impressions,
    clicks: campaign.metrics.clicks,
    conversions: campaign.metrics.conversions,
    investment,
    revenue,
    roi: campaign.metrics.roi,
    roas: ratio(revenue, investment),
    ctr: ratio(campaign.metrics.clicks, campaign.metrics.impressions) == null
      ? null
      : ratio(campaign.metrics.clicks, campaign.metrics.impressions)! * 100,
    cpa: ratio(investment, campaign.metrics.conversions),
    period: `${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}`,
  };
}

function mapRows(
  source: AnalyticsOverview["breakdownByDimension"][keyof AnalyticsOverview["breakdownByDimension"]] | undefined,
): BreakdownRow[] {
  return (source ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    reach: row.reach,
    impressions: row.impressions,
    engagement: row.engagement,
    clicks: row.clicks,
    conversions: row.conversions,
    roi: row.roi,
  }));
}

function campaignPlatforms(campaigns: MarketingCampaign[]): PlatformBlock[] {
  const ids: PlatformId[] = ["youtube", "tiktok", "instagram", "spotify", "google"];
  return ids.flatMap((id) => {
    const scoped = campaigns.filter((campaign) =>
      campaign.platforms.some((platform) => platformId(platform) === id),
    );
    if (!scoped.length) return [];
    const totals = scoped.reduce((sum, campaign) => ({
      reach: sum.reach + campaign.metrics.reach,
      impressions: sum.impressions + campaign.metrics.impressions,
      engagement: sum.engagement + campaign.metrics.engagement,
      clicks: sum.clicks + campaign.metrics.clicks,
      conversions: sum.conversions + campaign.metrics.conversions,
      investment: sum.investment + campaign.budget,
    }), { reach: 0, impressions: 0, engagement: 0, clicks: 0, conversions: 0, investment: 0 });
    return [{
      id,
      label: id[0].toUpperCase() + id.slice(1),
      description: "Métricas consolidadas de campanhas persistidas.",
      groups: [{
        id: `${id}-campaigns`,
        label: "Campanhas",
        layer: "paid" as const,
        metrics: [
          { id: `${id}-reach`, label: "Alcance", value: totals.reach, format: "compact" as const },
          { id: `${id}-impressions`, label: "Impressões", value: totals.impressions, format: "compact" as const },
          { id: `${id}-engagement`, label: "Engajamento", value: totals.engagement, format: "compact" as const },
          { id: `${id}-clicks`, label: "Cliques", value: totals.clicks, format: "compact" as const },
          { id: `${id}-conversions`, label: "Conversões", value: totals.conversions, format: "integer" as const },
          { id: `${id}-investment`, label: "Investimento", value: totals.investment, format: "currency" as const },
        ],
      }],
    }];
  });
}

function platformBreakdown(campaigns: MarketingCampaign[]): BreakdownRow[] {
  return campaignPlatforms(campaigns).map((block) => {
    // Keyed by the stable metric id, never by the PT-BR display label.
    const metrics = Object.fromEntries(
      block.groups.flatMap((group) => group.metrics.map((metric) => [metric.id, metric.value ?? 0])),
    );
    return {
      key: block.id,
      label: block.label,
      platform: block.id,
      reach: Number(metrics[`${block.id}-reach`] ?? 0),
      impressions: Number(metrics[`${block.id}-impressions`] ?? 0),
      engagement: Number(metrics[`${block.id}-engagement`] ?? 0),
      clicks: Number(metrics[`${block.id}-clicks`] ?? 0),
      conversions: Number(metrics[`${block.id}-conversions`] ?? 0),
      roi: 0,
    };
  });
}

function executiveKpis(overview: AnalyticsOverview | undefined, campaigns: MarketingCampaign[]): MetricCardVM[] {
  const totals = overview?.totals;
  const investment = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);
  return [
    { id: "reach", label: "Alcance total", value: totals?.reach ?? null, format: "compact" },
    { id: "impressions", label: "Impressões", value: totals?.impressions ?? null, format: "compact" },
    { id: "engagement", label: "Engajamento", value: totals?.engagement ?? null, format: "compact", accent: "success" },
    { id: "clicks", label: "Cliques", value: totals?.clicks ?? null, format: "compact" },
    { id: "conversions", label: "Conversões", value: totals?.conversions ?? null, format: "integer", accent: "success" },
    { id: "investment", label: "Investimento", value: investment || null, format: "currency", accent: "warning" },
    { id: "roi", label: "ROI médio", value: totals?.roi ?? null, format: "roi", accent: "success" },
    { id: "cpr", label: "Custo por resultado", value: totals?.costPerResult ?? null, format: "currency" },
    { id: "approval", label: "Taxa de aprovação", value: totals?.approvalRate ?? null, format: "percent" },
    { id: "published", label: "Conteúdos publicados", value: totals?.publishedContents ?? null, format: "integer" },
    { id: "late", label: "Conteúdos atrasados", value: totals?.lateContents ?? null, format: "integer", accent: "destructive" },
    { id: "audience", label: "Audiência consolidada", value: null, format: "compact" },
    { id: "streams", label: "Streams", value: null, format: "compact" },
    { id: "views", label: "Visualizações", value: null, format: "compact" },
    { id: "revenue", label: "Receita atribuída", value: null, format: "currency" },
    { id: "roas", label: "ROAS", value: null, format: "roas" },
  ];
}

function trend(overview: AnalyticsOverview | undefined): TrendPoint[] {
  return (overview?.series ?? []).map((point) => ({
    label: point.label,
    reach: point.reach,
    engagement: point.engagement,
    conversions: point.conversions,
    streams: 0,
  }));
}

export function buildAnalyticsHubModel(
  overview: AnalyticsOverview | undefined,
  campaigns: MarketingCampaign[],
): AnalyticsHubModel {
  const source = overview?.breakdownByDimension;
  const unavailable: BreakdownRow[] = [];
  const breakdown: Record<BreakdownDimension, BreakdownRow[]> = {
    campaign: mapRows(source?.campaign),
    channel: mapRows(source?.channel),
    platform: platformBreakdown(campaigns),
    artist: mapRows(source?.artist),
    music_project: mapRows(source?.music_project),
    company: mapRows(source?.company),
    music: unavailable,
    release: unavailable,
    period: mapRows(source?.period),
    owner: mapRows(source?.owner),
    content_type: mapRows(source?.content_type),
    territory: unavailable,
  };
  return {
    dataSource: "partial",
    executiveKpis: executiveKpis(overview, campaigns),
    trend: trend(overview),
    platforms: campaignPlatforms(campaigns),
    artists: [],
    music: [],
    campaigns: campaigns.map(toCampaignVM),
    content: [],
    breakdown,
  };
}

export function rankContent(content: ContentPerformance[], platform: PlatformId): ContentPerformance[] {
  const scoped = platform === "overview" ? content : content.filter((item) => item.platform === platform);
  return [...scoped].sort((a, b) => b.metricValue - a.metricValue);
}
