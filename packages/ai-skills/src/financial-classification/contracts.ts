/**
 * packages/ai-skills/src/financial-classification/contracts.ts
 *
 * Contracts of the financial-classification skill (version 1.0.0).
 * Financial classification of transactions for record labels, publishers and
 * production companies.
 * Shared canonical source (web + api).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type FinancialClassificationLanguage = SkillLanguage;

export type FinancialDirection = "income" | "expense";

export type FinancialRecurrence =
  | "one-time"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "unknown";

export type LinkedEntityType =
  | "artist"
  | "project"
  | "release"
  | "contract"
  | "campaign"
  | "supplier"
  | "client"
  | "none";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface FinancialClassificationInput {
  description: string;
  amount: number;
  date?: string;
  direction: FinancialDirection;
  relatedArtist?: string;
  relatedProject?: string;
  relatedRelease?: string;
  context?: string;
  language?: FinancialClassificationLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface LinkedEntitySuggestion {
  entityType?: LinkedEntityType;
  entityName?: string;
  reason?: string;
}

export interface FinancialRisk {
  risk: string;
  severity: SkillSeverity;
  recommendation: string;
}

export interface FinancialRecommendedAction {
  action: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface FinancialClassificationOutput {
  category: string;
  costCenter: string;
  suggestedTags: string[];
  recurrence: FinancialRecurrence;
  confidence: number;
  accountingNotes: string[];
  linkedEntitySuggestion: LinkedEntitySuggestion;
  risks: FinancialRisk[];
  recommendedActions: FinancialRecommendedAction[];
}
