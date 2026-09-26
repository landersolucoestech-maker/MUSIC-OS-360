/**
 * packages/ai-skills/src/campaign-plan/contracts.ts
 *
 * Contracts of the campaign-plan skill (version 1.0.0).
 * Initial tactical plan of a newly created marketing campaign — channels,
 * budget allocation, schedule milestones and suggested tasks.
 * Shared canonical source (web + api).
 *
 * Scope distinction within the campaigns cluster:
 *   campaign-plan     (campaign.created) — initial tactical plan, BEFORE the
 *                      campaign starts running.
 *   campaign-strategy (campaign.started) — strategic direction/positioning
 *                      when the campaign goes into execution.
 *   campaign-report   (campaign.ended)   — execution retrospective at the end.
 */

import type { SkillLanguage, SkillPriority, SkillSeverity } from "../shared/primitives";

export type CampaignPlanLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CampaignPlanInput {
  campaignName: string;
  campaignType: string;
  objective?: string;
  budget?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  relatedArtist?: string;
  platforms?: string[];
  context?: string;
  language?: CampaignPlanLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface CampaignPlanChannel {
  channel: string;
  rationale: string;
  suggestedBudgetSharePercent: number;
}

export interface CampaignPlanMilestone {
  milestone: string;
  timing: string;
}

export interface CampaignPlanTask {
  task: string;
  area: string;
  priority: SkillPriority;
}

export interface CampaignPlanRisk {
  risk: string;
  severity: SkillSeverity;
  mitigation: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CampaignPlanOutput {
  planSummary: string;
  channels: CampaignPlanChannel[];
  milestones: CampaignPlanMilestone[];
  suggestedTasks: CampaignPlanTask[];
  risks: CampaignPlanRisk[];
  budgetNotes: string;
}
