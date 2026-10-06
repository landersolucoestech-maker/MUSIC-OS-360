/**
 * packages/ai-skills/src/release-checklist/contracts.ts
 *
 * Contracts of the release-checklist skill (version 1.0.0).
 * Shared canonical source (web + api).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type ReleaseChecklistLanguage = SkillLanguage;

export type ReleaseType =
  | "single"
  | "ep"
  | "album"
  | "mixtape"
  | "video"
  | "other";

export type ReleaseStatus =
  | "not-ready"
  | "needs-attention"
  | "almost-ready"
  | "ready";

export type ItemSeverity = SkillSeverity;

export type ActionPriority = SkillPriority;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ReleaseChecklistInput {
  releaseTitle: string;
  artistName: string;
  releaseType: ReleaseType;
  releaseDate?: string;
  hasCover: boolean;
  hasIsrc: boolean;
  hasUpc: boolean;
  hasContracts: boolean;
  hasSplits: boolean;
  hasMarketingPlan: boolean;
  context?: string;
  language?: ReleaseChecklistLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface MissingItem {
  item: string;
  area: string;
  severity: ItemSeverity;
  reason: string;
}

export interface CriticalIssue {
  issue: string;
  impact: string;
  recommendedFix: string;
}

export interface ChecklistItem {
  item: string;
  completed: boolean;
  area: string;
  required: boolean;
}

export interface RecommendedAction {
  action: string;
  priority: ActionPriority;
  ownerArea: string;
}

export interface MetadataReview {
  hasMinimumMetadata: boolean;
  missingMetadata: string[];
  notes: string[];
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface ReleaseChecklistOutput {
  readinessScore: number;
  status: ReleaseStatus;
  missingItems: MissingItem[];
  criticalIssues: CriticalIssue[];
  warnings: string[];
  checklist: ChecklistItem[];
  recommendedActions: RecommendedAction[];
  metadataReview: MetadataReview;
}
