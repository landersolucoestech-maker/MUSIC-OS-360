/**
 * Marketing analytics center ("Central Analítica") — dedicated hook.
 *
 * Single owner of the page's loading / error / data / filters / refresh and the
 * data-source flag. The page stays a thin container — no heavy logic in JSX.
 *
 * Combines persisted operational analytics and campaigns. Metrics not supplied
 * by a live integration remain explicitly unavailable.
 */

import { useMemo, useState } from "react";
import { useMarketingAnalytics } from "./useMarketingAnalytics";
import { useMarketingCampaigns } from "./useMarketingCampaigns";
import {
  buildAnalyticsHubModel,
  rankContent,
} from "../analytics/analytics-hub.data";
import {
  BREAKDOWN_OPTIONS,
  CONTEXT_OPTIONS,
  PLATFORM_OPTIONS,
  isAnalyticsContext,
  isBreakdownDimension,
  isPlatformId,
} from "../analytics/analytics-hub.format";
import type {
  AnalyticsContext,
  BreakdownDimension,
  PlatformId,
} from "../analytics/analytics-hub.types";

export function useMarketingAnalyticsHub() {
  const analytics = useMarketingAnalytics();
  const campaigns = useMarketingCampaigns();

  const [context, setContextState] = useState<AnalyticsContext>("overview");
  const [platform, setPlatformState] = useState<PlatformId>("overview");
  const [dimension, setDimensionState] = useState<BreakdownDimension>("campaign");

  // Validate raw Select values before narrowing — never trust the string blindly.
  const setContext = (value: string) => {
    if (isAnalyticsContext(value)) setContextState(value);
  };
  const setPlatform = (value: string) => {
    if (isPlatformId(value)) setPlatformState(value);
  };
  const setDimension = (value: string) => {
    if (isBreakdownDimension(value)) setDimensionState(value);
  };

  const isLoading = analytics.isLoading || campaigns.isLoading;
  const isError = analytics.isError || campaigns.isError;
  const error = analytics.error ?? campaigns.error ?? null;

  const model = useMemo(
    () => buildAnalyticsHubModel(analytics.data, campaigns.data ?? []),
    [analytics.data, campaigns.data],
  );

  const platformBlock = useMemo(
    () => model.platforms.find((p) => p.id === platform) ?? null,
    [model.platforms, platform],
  );

  const rankedContent = useMemo(
    () => rankContent(model.content, platform),
    [model.content, platform],
  );

  const breakdownRows = useMemo(
    () => model.breakdown[dimension] ?? [],
    [model.breakdown, dimension],
  );

  const refresh = () => {
    void analytics.refetch();
    void campaigns.refetch();
  };

  return {
    isLoading,
    isError,
    error,
    refresh,
    isFetching: analytics.isFetching || campaigns.isFetching,
    dataSource: model.dataSource,

    // filters
    context,
    setContext,
    platform,
    setPlatform,
    dimension,
    setDimension,
    contextOptions: CONTEXT_OPTIONS,
    platformOptions: PLATFORM_OPTIONS,
    breakdownOptions: BREAKDOWN_OPTIONS,

    // data
    executiveKpis: model.executiveKpis,
    trend: model.trend,
    platforms: model.platforms,
    platformBlock,
    artists: model.artists,
    music: model.music,
    campaigns: model.campaigns,
    content: rankedContent,
    breakdownRows,
  };
}

export type AnalyticsHubController = ReturnType<typeof useMarketingAnalyticsHub>;

