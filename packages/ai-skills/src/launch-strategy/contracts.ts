/**
 * packages/ai-skills/src/launch-strategy/contracts.ts
 *
 * Contracts of the launch-strategy skill (version 1.0.0).
 * Strategic/narrative launch direction of an approved release — positioning,
 * target audience, key messages and success signals to watch.
 * Shared canonical source (web + api).
 *
 * Scope distinction (same release, same release.approved event, three
 * non-overlapping skills):
 *   marketing-calendar-builder — WHEN/WHERE: tactical post calendar per
 *                                 platform/cadence.
 *   audiovisual-briefing       — audiovisual production briefing.
 *   launch-strategy            — WHY/FOR WHOM/WHICH MESSAGE: the launch's
 *                                 strategic narrative and positioning (the
 *                                 same role campaign-strategy plays for
 *                                 campaigns — see campaign-strategy/contracts.ts).
 *
 * successSignals is deliberately qualitative (signal + why), never a numeric
 * metric — fabricated performance numbers are forbidden by the mission (see
 * campaign-report/contracts.ts for the same principle applied to metrics).
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type LaunchStrategyLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface LaunchStrategyInput {
  releaseTitle: string;
  releaseType: string;
  artistName?: string;
  genre?: string;
  releaseDate?: string;
  existingCalendarSummary?: string;
  context?: string;
  language?: LaunchStrategyLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface LaunchKeyMessage {
  message: string;
  audience: string;
}

export interface LaunchSuccessSignal {
  signal: string;
  why: string;
}

export interface LaunchRiskFactor {
  risk: string;
  severity: SkillSeverity;
  mitigation: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface LaunchStrategyOutput {
  strategicNarrative: string;
  targetAudience: string;
  competitivePositioning: string;
  keyMessages: LaunchKeyMessage[];
  successSignals: LaunchSuccessSignal[];
  riskFactors: LaunchRiskFactor[];
}
