/**
 * packages/ai-skills/src/support-triage/contracts.ts
 *
 * Contracts of the support-triage skill (version 1.0.0).
 * Support ticket triage for a SaaS serving record labels, publishers and
 * production companies.
 * Shared canonical source (web + api).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type SupportTriageLanguage = SkillLanguage;

export type SupportModule =
  | "artists"
  | "releases"
  | "contracts"
  | "financial"
  | "catalog"
  | "marketing"
  | "audiovisual"
  | "agenda"
  | "integrations"
  | "ai"
  | "settings"
  | "support"
  | "other";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface SupportTriageInput {
  subject: string;
  message: string;
  userRole?: string;
  affectedModule?: SupportModule;
  context?: string;
  language?: SupportTriageLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface SLARecommendation {
  responseTime: string;
  resolutionTime?: string;
  reason: string;
}

export interface SupportRecommendedAction {
  action: string;
  priority: SkillPriority;
  ownerArea?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface SupportTriageOutput {
  category: string;
  priority: SkillPriority;
  severity: SkillSeverity;
  affectedModule: string;
  likelyCause: string;
  suggestedResponse: string;
  escalationNeeded: boolean;
  SLARecommendation: SLARecommendation;
  internalNotes: string[];
  recommendedActions: SupportRecommendedAction[];
}
