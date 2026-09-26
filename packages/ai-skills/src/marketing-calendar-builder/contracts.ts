/**
 * skills/marketing-calendar-builder/contracts/marketing-calendar-builder.contracts.ts
 *
 * Contracts of the marketing-calendar-builder skill (version 1.0.0).
 * Builds a music marketing calendar (pre-launch/launch/post-launch/institutional).
 * Uses the shared domain/ai.types types (SkillLanguage/SkillPriority).
 */

import type { SkillLanguage, SkillPriority } from "../shared/primitives";

export type MarketingPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "shorts"
  | "spotify"
  | "facebook"
  | "x"
  | "linkedin"
  | "website"
  | "email"
  | "whatsapp"
  | "other";

export type MarketingFrequency = "low" | "medium" | "high" | "intensive";

export type MarketingCalendarStatus = "planned";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface MarketingCalendarBuilderInput {
  artistName: string;
  releaseTitle?: string;
  campaignGoal: string;
  startDate: string;
  endDate: string;
  platforms: MarketingPlatform[];
  frequency: MarketingFrequency;
  context?: string;
  language?: SkillLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface MarketingCalendarEntry {
  date: string;
  platform: string;
  contentType: string;
  title: string;
  description: string;
  cta?: string;
  status: MarketingCalendarStatus;
}

export interface ContentPillar {
  pillar: string;
  description: string;
  examples: string[];
}

export interface MarketingDailyAction {
  date: string;
  action: string;
  priority: SkillPriority;
}

export interface PlatformStrategy {
  platform: string;
  strategy: string;
  frequencySuggestion: string;
}

export interface MarketingCampaignPhase {
  name: string;
  startDate: string;
  endDate: string;
  objective: string;
}

export interface MarketingProductionNeed {
  item: string;
  area: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface MarketingCalendarBuilderOutput {
  calendar: MarketingCalendarEntry[];
  contentPillars: ContentPillar[];
  dailyActions: MarketingDailyAction[];
  platformStrategy: PlatformStrategy[];
  CTAs: string[];
  campaignPhases: MarketingCampaignPhase[];
  productionNeeds: MarketingProductionNeed[];
}
