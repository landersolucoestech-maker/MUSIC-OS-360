/**
 * packages/ai-skills/src/ad-creative/contracts.ts
 *
 * Contracts of the ad-creative skill (version 1.0.0).
 * Creative suggestions (headline/copy/description/CTA) for a paid media
 * campaign ALREADY IN DRAFT in the real Campaign Builder
 * (MarketingCampaignBuilderService/CampaignEntity with type='marketing_builder')
 * — it never invents a campaign or persists the creative directly.
 *
 * Scope deliberately limited to GENERATING creative text — never launching or
 * publishing (the backend itself declares `/publish` as a self-documented
 * stub: "Provider-side publishing is not executed by this stub endpoint";
 * marketing-integration.contract.ts declares `available: false` for every ads
 * provider). This skill never implies an ad was served and never produces
 * performance numbers (reach/clicks/conversions/ROAS) — see
 * docs/CODEBASE_MAP.md (historical snapshot) on `estimateCampaignResults()` already being a fabricated
 * metric shown as real; this skill does not repeat that pattern.
 *
 * Scope distinction: paid-ads suggests budget/platform ALLOCATION; ad-creative
 * suggests the creative TEXT for ONE specific platform/placement — they do not
 * overlap.
 *
 * Execution: ON_DEMAND (see on-demand-skill.runner.ts), triggered by the user
 * inside the Campaign Builder — never automatically.
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type AdCreativeLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AdCreativeInput {
  campaignName: string;
  objective: string;
  expectedOutcome?: string;
  promotedEntityType: string;
  promotedEntityName: string;
  platform: string;
  placement: string;
  destinationUrl?: string;
  audienceSummary?: string;
  context?: string;
  language?: AdCreativeLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface AdCreativeVariant {
  headline: string;
  primaryCopy: string;
  description: string;
  cta: string;
  tone: string;
}

export interface AdCreativeRisk {
  risk: string;
  severity: SkillSeverity;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface AdCreativeOutput {
  creativeSummary: string;
  variants: AdCreativeVariant[];
  platformNotes: string;
  risks: AdCreativeRisk[];
}
