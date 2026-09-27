/**
 * Marketing Module — public surface.
 *
 * Pages are imported directly (lazily) by the router; this barrel exposes the
 * reusable building blocks (types, constants, hooks, services, components) for
 * any future cross-module consumption.
 */

export * from "./types/marketing.types";
export * from "./constants/marketing.constants";
export * from "./components";

// Hooks
export * from "./hooks/useMarketingProjects";
export * from "./hooks/useMarketingCampaigns";
export * from "./hooks/useMarketingContents";
export * from "./hooks/useMarketingBriefings";
export * from "./hooks/useMarketingTasks";
export * from "./hooks/useMarketingAssets";
export * from "./hooks/useMarketingDashboard";
export * from "./hooks/useMarketingAnalytics";
export * from "./hooks/useMarketingAutomations";
export * from "./hooks/useMarketingAI";
export * from "./hooks/useGoals";

// Services & contracts
export { marketingService } from "./services/marketing.service";
export {
  AUTOMATION_FLOWS,
  runAutomationFlow,
  getFlow,
} from "./services/marketing-automation.service";
export * from "./services/marketing-integration.contract";

// Formatting utils
export * from "./utils/marketing-format";

