/**
 * Central Analítica — formatting, platform metadata, option lists and the
 * runtime type-guards used to validate Select values before updating state.
 */

import type { ComponentType } from "react";
import { Globe } from "lucide-react";
import {
  SiGoogle,
  SiInstagram,
  SiSpotify,
  SiTiktok,
  SiYoutube,
} from "react-icons/si";
import {
  formatCompact,
  formatCurrency,
  formatHours,
  formatNumber,
  formatPercent,
  formatRoas,
  formatRoi,
} from "../utils/marketing-format";
import type {
  AnalyticsContext,
  BreakdownDimension,
  MetricFormat,
  PlatformId,
} from "./analytics-hub.types";

/** Render any metric safely — null/undefined/NaN/Infinity all become "—". */
export function formatMetric(value: number | null | undefined, format: MetricFormat): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  switch (format) {
    case "compact":
      return formatCompact(value);
    case "integer":
      return formatNumber(value);
    case "currency":
      return formatCurrency(value);
    case "percent":
      return formatPercent(value);
    case "roi":
      return formatRoi(value);
    case "roas":
      return formatRoas(value);
    case "duration":
      return formatHours(value);
    default:
      return formatNumber(value);
  }
}

// ---------------------------------------------------------------------------
// Platform metadata (icon + colour for the visual indicator)
// ---------------------------------------------------------------------------

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Tailwind text colour for the platform indicator. */
  colorClass: string;
}

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  overview: { id: "overview", label: "Visão geral", icon: Globe, colorClass: "text-primary" },
  youtube: { id: "youtube", label: "YouTube", icon: SiYoutube, colorClass: "text-red-500" },
  tiktok: { id: "tiktok", label: "TikTok", icon: SiTiktok, colorClass: "text-foreground" },
  instagram: { id: "instagram", label: "Instagram", icon: SiInstagram, colorClass: "text-pink-500" },
  spotify: { id: "spotify", label: "Spotify", icon: SiSpotify, colorClass: "text-emerald-500" },
  google: { id: "google", label: "Google", icon: SiGoogle, colorClass: "text-blue-500" },
};

export const PLATFORM_OPTIONS: { value: PlatformId; label: string }[] = (
  ["overview", "youtube", "tiktok", "instagram", "spotify", "google"] as PlatformId[]
).map((id) => ({ value: id, label: PLATFORM_META[id].label }));

export const CONTEXT_OPTIONS: { value: AnalyticsContext; label: string }[] = [
  { value: "overview", label: "Visão geral" },
  { value: "platforms", label: "Plataformas" },
  { value: "artists", label: "Artistas" },
  { value: "music", label: "Músicas" },
  { value: "releases", label: "Lançamentos" },
  { value: "content", label: "Conteúdos" },
  { value: "campaigns", label: "Campanhas" },
  { value: "traffic", label: "Tráfego" },
  { value: "audience", label: "Audiência" },
];

export const BREAKDOWN_OPTIONS: { value: BreakdownDimension; label: string }[] = [
  { value: "campaign", label: "Campanha" },
  { value: "channel", label: "Canal" },
  { value: "platform", label: "Plataforma" },
  { value: "artist", label: "Artista" },
  { value: "music_project", label: "Projeto Musical" },
  { value: "company", label: "Empresa" },
  { value: "music", label: "Música" },
  { value: "release", label: "Lançamento" },
  { value: "period", label: "Período" },
  { value: "owner", label: "Responsável" },
  { value: "content_type", label: "Tipo de conteúdo" },
  { value: "territory", label: "Território" },
];

// ---------------------------------------------------------------------------
// Guards — validate raw Select strings before narrowing to a union
// ---------------------------------------------------------------------------

const PLATFORM_SET = new Set(PLATFORM_OPTIONS.map((o) => o.value));
const CONTEXT_SET = new Set(CONTEXT_OPTIONS.map((o) => o.value));
const BREAKDOWN_SET = new Set(BREAKDOWN_OPTIONS.map((o) => o.value));

export function isPlatformId(value: string): value is PlatformId {
  return PLATFORM_SET.has(value as PlatformId);
}

export function isAnalyticsContext(value: string): value is AnalyticsContext {
  return CONTEXT_SET.has(value as AnalyticsContext);
}

export function isBreakdownDimension(value: string): value is BreakdownDimension {
  return BREAKDOWN_SET.has(value as BreakdownDimension);
}

