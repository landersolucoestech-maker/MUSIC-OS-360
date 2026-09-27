/**
 * packages/ai-skills/src/artist-profile-analysis/contracts.ts
 *
 * Contracts of the artist-profile-analysis skill (version 1.0.0).
 * Artist profile analysis — positioning, audience, strengths/weaknesses,
 * opportunities, risks, brand narrative and recommended actions.
 * Shared canonical source (web + api).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type ArtistProfileAnalysisLanguage = SkillLanguage;

// ─── Input blocks ─────────────────────────────────────────────────────────────

export interface ArtistPlatformProfile {
  platform: string;
  handle?: string;
  followers?: number;
  notes?: string;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ArtistProfileAnalysisInput {
  artistName: string;
  genre?: string;
  audience?: string;
  strengths?: string[];
  weaknesses?: string[];
  platforms?: ArtistPlatformProfile[];
  context?: string;
  language?: ArtistProfileAnalysisLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface ArtistStrength {
  point: string;
  impact: string;
}

export interface ArtistWeakness {
  point: string;
  risk: string;
  recommendation: string;
}

export interface ArtistOpportunity {
  opportunity: string;
  priority: SkillPriority;
  rationale: string;
}

export interface ArtistRisk {
  risk: string;
  severity: SkillSeverity;
  mitigation: string;
}

export interface ArtistRecommendedAction {
  action: string;
  area: string;
  priority: SkillPriority;
}

export interface ArtistPlatformRecommendation {
  platform: string;
  recommendation: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface ArtistProfileAnalysisOutput {
  positioning: string;
  audienceAnalysis: string;
  strengths: ArtistStrength[];
  weaknesses: ArtistWeakness[];
  opportunities: ArtistOpportunity[];
  risks: ArtistRisk[];
  brandNarrative: string;
  recommendedActions: ArtistRecommendedAction[];
  platformRecommendations: ArtistPlatformRecommendation[];
}
