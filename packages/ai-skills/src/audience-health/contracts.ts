/**
 * packages/ai-skills/src/audience-health/contracts.ts
 *
 * Contracts of the audience-health skill (version 1.0.0).
 * Narrative synthesis of an artist's audience state, from results ALREADY
 * COMPUTED by the Career Stage Engine and the Market Benchmark Engine
 * (Phase 3/3.2) — it never calls providers live, never recomputes metrics, and
 * never fabricates a number the engines did not produce.
 *
 * Execution: ON_DEMAND + stale-refresh (see
 * apps/api/src/core/automation/on-demand-skill.runner.ts) — triggered by an
 * explicit user action on the artist screen, reusing the last result within a
 * freshness window instead of generating on every view.
 *
 * No overlap: artist-profile-analysis reads only the `artists` table (basic
 * profile); audience-health reads exclusively the analytics ENGINES (career
 * stage + market benchmark) — neither duplicates the other.
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type AudienceHealthLanguage = SkillLanguage;

export type AudienceHealthStatus = "healthy" | "attention" | "critical" | "insufficient_data";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AudienceHealthInput {
  artistName: string;
  careerStageStatus: "OK" | "INSUFFICIENT_DATA";
  careerStageScore?: number;
  careerStageClassification?: string;
  careerStageConfidence: number;
  careerStagePositiveFactors: string[];
  careerStageBottlenecks: string[];
  marketBenchmarkReadStatus: "READY" | "STALE" | "REFRESHING" | "INTEGRATION_UNAVAILABLE" | "ERROR";
  marketBenchmarkScore?: number;
  marketBenchmarkLabel?: string;
  context?: string;
  language?: AudienceHealthLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface AudienceHealthStrength {
  strength: string;
  evidence: string;
}

export interface AudienceHealthConcern {
  concern: string;
  severity: SkillSeverity;
  evidence: string;
}

export interface AudienceHealthAction {
  action: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface AudienceHealthOutput {
  healthSummary: string;
  healthStatus: AudienceHealthStatus;
  strengths: AudienceHealthStrength[];
  concerns: AudienceHealthConcern[];
  recommendedActions: AudienceHealthAction[];
  dataGaps: string[];
}
