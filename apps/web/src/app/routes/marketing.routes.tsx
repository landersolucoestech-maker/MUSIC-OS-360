/**
 * Marketing Routes — modular route group for the Marketing module.
 * Paths are stable; Marketing owns campaigns, content, tasks, metrics and AI.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const MarketingOverview = lazy(() => import("@/modules/marketing/pages/Overview"));
const MarketingCampaigns = lazy(() => import("@/modules/marketing/pages/Campaigns"));
const MarketingCalendar = lazy(() => import("@/modules/marketing/pages/Calendar"));
const MarketingTasks = lazy(() => import("@/modules/marketing/pages/Tasks"));
const MarketingMetrics = lazy(() => import("@/modules/marketing/pages/Metrics"));
const MarketingBriefing = lazy(() => import("@/modules/marketing/pages/Briefing"));
const MarketingAiCreative = lazy(() => import("@/modules/marketing/pages/AiCreative"));

export function marketingRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/marketing" element={<Navigate to="/marketing/overview" replace />} />
      <Route path="/marketing/overview" element={<P><MarketingOverview /></P>} />
      <Route path="/marketing/campaigns" element={<P><MarketingCampaigns /></P>} />
      <Route path="/marketing/calendar" element={<P><MarketingCalendar /></P>} />
      <Route path="/marketing/tasks" element={<P><MarketingTasks /></P>} />
      <Route path="/marketing/metrics" element={<P><MarketingMetrics /></P>} />
      <Route path="/marketing/briefing" element={<P><MarketingBriefing /></P>} />
      <Route path="/marketing/creative-ai" element={<P><MarketingAiCreative /></P>} />
      <Route path="/marketing/briefings" element={<Navigate to="/marketing/briefing" replace />} />
      <Route path="/marketing/asset-library" element={<Navigate to="/marketing/tasks" replace />} />
    </>
  );
}
