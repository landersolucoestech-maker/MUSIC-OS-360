/**
 * packages/ai-skills/src/catalog-metadata-validator/contracts.ts
 *
 * Contracts of the catalog-metadata-validator skill (version 1.0.0).
 * Music catalog metadata validation — work and phonogram (recording).
 * Shared canonical source (web + api).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type CatalogMetadataValidatorLanguage = SkillLanguage;

export type CatalogMetadataType = "work" | "recording";

// ─── Blocos de entrada ────────────────────────────────────────────────────────

export interface CatalogComposer {
  name: string;
  share?: number;
  publisher?: string;
}

export interface CatalogShare {
  name: string;
  role: string;
  percentage: number;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CatalogMetadataValidatorInput {
  title: string;
  type: CatalogMetadataType;
  composers?: CatalogComposer[];
  performers?: string[];
  producers?: string[];
  isrc?: string;
  upc?: string;
  publisher?: string;
  label?: string;
  shares?: CatalogShare[];
  context?: string;
  language?: CatalogMetadataValidatorLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface CatalogFieldIssue {
  field: string;
  message: string;
  severity: SkillSeverity;
}

export interface DuplicateRisk {
  reason: string;
  confidence: number;
  matchedFields: string[];
}

export interface RightsRisk {
  risk: string;
  severity: SkillSeverity;
  recommendation: string;
}

export interface NormalizedMetadata {
  title: string;
  type: CatalogMetadataType;
  composers: CatalogComposer[];
  performers: string[];
  producers: string[];
  isrc?: string;
  upc?: string;
  publisher?: string;
  label?: string;
  shares: CatalogShare[];
}

export interface RecommendedFix {
  action: string;
  priority: SkillPriority;
  field?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CatalogMetadataValidatorOutput {
  isValid: boolean;
  score: number;
  errors: CatalogFieldIssue[];
  warnings: CatalogFieldIssue[];
  missingFields: string[];
  duplicateRisks: DuplicateRisk[];
  rightsRisks: RightsRisk[];
  normalizedMetadata: NormalizedMetadata;
  recommendedFixes: RecommendedFix[];
}
