/**
 * packages/ai-skills/src/paid-ads/contracts.ts
 *
 * Contracts of the paid-ads skill (version 1.0.0).
 * Suggested budget allocation and placement across paid media platforms for a
 * campaign ALREADY IN DRAFT in the real Campaign Builder
 * (MarketingCampaignBuilderService/CampaignEntity with type='marketing_builder').
 *
 * Scope distinction: ad-creative suggests the creative TEXT for a specific
 * platform/placement; paid-ads suggests HOW to split the budget ACROSS the
 * selected platforms (the real CampaignBudget.platformSplit field) and which
 * placements to prioritize — they do not overlap. Neither launches/manages ads:
 * the real backend already declares `/publish` as a self-documented stub and
 * every ads provider as `available: false` (marketing-integration.contract.ts).
 *
 * ANTI-FABRICATION: this skill NEVER produces a numeric performance forecast
 * (CPA, ROAS, estimated CTR) — only budget allocation percentages (summing to
 * 100%, renormalized in the parser) and qualitative recommendations.
 * docs/CODEBASE_MAP.md documents that `estimateCampaignResults()` already
 * fabricates metrics shown as real; this skill neither reproduces that pattern
 * nor reads/writes those fields.
 *
 * Execution: ON_DEMAND, triggered by the user inside the Campaign Builder.
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type PaidAdsLanguage = SkillLanguage;

export interface PaidAdsPlatformInput {
  platform: string;
  compatiblePlacements: string[];
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface PaidAdsInput {
  campaignName: string;
  objective: string;
  expectedOutcome?: string;
  promotedEntityType: string;
  promotedEntityName: string;
  platforms: PaidAdsPlatformInput[];
  totalBudget?: number;
  dailyBudget?: number;
  currency?: string;
  audienceSummary?: string;
  context?: string;
  language?: PaidAdsLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface PaidAdsPlatformSplit {
  platform: string;
  percentageShare: number;
  rationale: string;
}

export interface PaidAdsPlacementRecommendation {
  platform: string;
  placement: string;
  rationale: string;
}

export interface PaidAdsRisk {
  risk: string;
  severity: SkillSeverity;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface PaidAdsOutput {
  strategySummary: string;
  platformSplit: PaidAdsPlatformSplit[];
  placementRecommendations: PaidAdsPlacementRecommendation[];
  budgetNotes: string;
  risks: PaidAdsRisk[];
}
