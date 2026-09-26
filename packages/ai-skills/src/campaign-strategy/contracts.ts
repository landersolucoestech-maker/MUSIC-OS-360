/**
 * packages/ai-skills/src/campaign-strategy/contracts.ts
 *
 * Contracts of the campaign-strategy skill (version 1.0.0).
 * Strategic direction of a campaign when it goes into execution — positioning,
 * target audience, key messages and signals to watch for course correction.
 * Shared canonical source (web + api).
 *
 * Scope distinction within the campaigns cluster — see
 * campaign-plan/contracts.ts for the full picture. This skill does NOT
 * recommend channels/budget/tasks (that is campaign-plan) and does NOT report
 * results (that is campaign-report); it defines HOW to communicate and WHAT to
 * watch while the campaign runs.
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type CampaignStrategyLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CampaignStrategyInput {
  campaignName: string;
  campaignType: string;
  objective?: string;
  relatedArtist?: string;
  startDate?: string;
  endDate?: string;
  existingPlanSummary?: string;
  context?: string;
  language?: CampaignStrategyLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface CampaignKeyMessage {
  message: string;
  audience: string;
}

export interface CampaignMetricToWatch {
  metric: string;
  why: string;
}

export interface CampaignAdjustmentTrigger {
  signal: string;
  severity: SkillSeverity;
  response: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CampaignStrategyOutput {
  strategicDirection: string;
  targetAudience: string;
  competitivePositioning: string;
  keyMessages: CampaignKeyMessage[];
  metricsToWatch: CampaignMetricToWatch[];
  adjustmentTriggers: CampaignAdjustmentTrigger[];
}
