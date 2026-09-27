/**
 * Marketing analytics center ("Central Analítica") — domain types.
 *
 * Pure type declarations for the music-marketing intelligence page. A
 * "platform" is the FULL ecosystem (organic + paid + consumption + audience +
 * conversion) — Ads are only one layer inside it, never the platform itself.
 */

import type { ComponentType } from "react";

/** Supported platforms. "overview" aggregates every platform. */
export type PlatformId = "overview" | "youtube" | "tiktok" | "instagram" | "spotify" | "google";

/** Analytical context (what the page is looking at). */
export type AnalyticsContext =
  | "overview"
  | "artists"
  | "music"
  | "releases"
  | "content"
  | "campaigns"
  | "platforms"
  | "traffic"
  | "audience";

/** Breakdown dimensions for the detail table. */
export type BreakdownDimension =
  | "campanha"
  | "canal"
  | "plataforma"
  | "artista"
  | "projeto_musical"
  | "empresa"
  | "musica"
  | "lancamento"
  | "periodo"
  | "responsavel"
  | "tipo_conteudo"
  | "territorio";

/** Where the displayed data comes from. Drives the (single) data alert. */
export type DataSourceStatus = "simulated" | "partial" | "live";

/** How a numeric metric should be rendered. */
export type MetricFormat = "compact" | "integer" | "currency" | "percent" | "roi" | "roas" | "duration";

export type MetricAccent = "primary" | "success" | "warning" | "destructive";

/** A KPI tile. `value === null` means the metric is unavailable (never NaN). */
export interface MetricCardVM {
  id: string;
  label: string;
  value: number | null;
  format: MetricFormat;
  accent?: MetricAccent;
  icon?: ComponentType<{ className?: string }>;
  /** Optional growth indicator in percent. */
  trend?: number | null;
  /** True when this value is simulated rather than from a live integration. */
  simulated?: boolean;
}

/** A single metric inside a platform layer. */
export interface PlatformMetric {
  id: string;
  label: string;
  value: number | null;
  format: MetricFormat;
}

/** A layer of a platform — organic, paid (ads), consumption, audience, ... */
export type PlatformLayer = "organic" | "paid" | "consumption" | "audience" | "conversion";

export interface PlatformMetricGroup {
  id: string;
  label: string;
  layer: PlatformLayer;
  metrics: PlatformMetric[];
}

export interface PlatformBlock {
  id: PlatformId;
  label: string;
  description: string;
  groups: PlatformMetricGroup[];
}

export interface ArtistPerformance {
  id: string;
  name: string;
  followers: number | null;
  listeners: number | null;
  streams: number | null;
  views: number | null;
  engagement: number | null;
  reach: number | null;
  revenue: number | null;
  investment: number | null;
  roi: number | null;
  growth: number | null;
  topContent: string;
}

export type MusicFormat = "single" | "ep" | "album" | "videoclipe";

export interface MusicPerformance {
  id: string;
  title: string;
  artist: string;
  format: MusicFormat;
  streams: number | null;
  saves: number | null;
  playlists: number | null;
  views: number | null;
  presaves: number | null;
  growth: number | null;
  revenue: number | null;
}

export interface CampaignPerformanceVM {
  id: string;
  name: string;
  type: string;
  status: string;
  owner: string;
  platform: string;
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  investment: number;
  revenue: number;
  roi: number;
  roas: number | null;
  ctr: number | null;
  cpa: number | null;
  period: string;
}

export interface ContentPerformance {
  id: string;
  title: string;
  artist: string;
  platform: PlatformId;
  contentType: string;
  metricLabel: string;
  metricValue: number;
  metricFormat: MetricFormat;
}

/** A point on the evolution chart. All series share a compatible scale group. */
export interface TrendPoint {
  label: string;
  reach: number;
  engagement: number;
  conversions: number;
  streams: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  platform?: PlatformId;
  reach: number;
  impressions: number;
  engagement: number;
  clicks: number;
  conversions: number;
  roi: number;
  status?: string;
}

/** Consolidated view model produced by the adapter / hook. */
export interface AnalyticsHubModel {
  dataSource: DataSourceStatus;
  executiveKpis: MetricCardVM[];
  trend: TrendPoint[];
  platforms: PlatformBlock[];
  artists: ArtistPerformance[];
  music: MusicPerformance[];
  campaigns: CampaignPerformanceVM[];
  content: ContentPerformance[];
  breakdown: Record<BreakdownDimension, BreakdownRow[]>;
}

