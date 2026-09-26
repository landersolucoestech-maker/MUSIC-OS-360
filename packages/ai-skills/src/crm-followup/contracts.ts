/**
 * skills/crm-followup/contracts/crm-followup.contracts.ts
 *
 * Contracts of the crm-followup skill (version 1.0.0).
 * CRM sales follow-up for record labels, publishers, production companies,
 * artists, partners, brands, suppliers and clients.
 * Uses the shared domain/ai.types types (SkillLanguage/SkillSeverity/SkillPriority).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type CrmLeadType =
  | "artist"
  | "label"
  | "publisher"
  | "producer"
  | "brand"
  | "partner"
  | "supplier"
  | "client"
  | "other";

export type CrmStage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "inactive";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CrmFollowupInput {
  leadName: string;
  leadType: CrmLeadType;
  currentStage: CrmStage;
  lastInteraction?: string;
  objective: string;
  context?: string;
  language?: SkillLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface CrmObjection {
  objection: string;
  responseStrategy: string;
  severity: SkillSeverity;
}

export interface CrmTask {
  title: string;
  description: string;
  priority: SkillPriority;
  dueInDays?: number;
}

export interface CrmStageRecommendation {
  currentStage: CrmStage;
  suggestedStage?: CrmStage;
  reason: string;
}

export interface CrmRisk {
  risk: string;
  severity: SkillSeverity;
  recommendation: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CrmFollowupOutput {
  priority: SkillPriority;
  nextAction: string;
  followUpMessage: string;
  suggestedDeadline?: string;
  objections: CrmObjection[];
  conversionProbability: number;
  tasks: CrmTask[];
  stageRecommendation: CrmStageRecommendation;
  risks: CrmRisk[];
}
