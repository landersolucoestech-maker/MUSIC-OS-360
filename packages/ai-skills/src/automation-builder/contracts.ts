/**
 * packages/ai-skills/src/automation-builder/contracts.ts
 *
 * Contracts of the automation-builder skill (version 1.0.0).
 * Improvement suggestions for the MusicChat automation configuration (triage
 * menu, escalation rules) based on REAL usage patterns — it never creates or
 * modifies `musicchat_automation_settings` automatically. The skill produces
 * SUGGESTIONS only; any real configuration change requires an explicit human
 * action on `PATCH /conversations/musicchat/automation/settings` (an existing
 * endpoint, unchanged by this skill).
 *
 * Execution: ON_DEMAND, triggered by an explicit user action — never
 * automatically when a data change is detected.
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type AutomationBuilderLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AutomationBuilderInput {
  currentMenuOptionLabels: string[];
  currentEscalationLevels: string[];
  invalidOptionCount: number;
  recentInvalidOptionSamples: string[];
  context?: string;
  language?: AutomationBuilderLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface AutomationBuilderMenuSuggestion {
  change: string;
  rationale: string;
}

export interface AutomationBuilderEscalationSuggestion {
  change: string;
  rationale: string;
}

export interface AutomationBuilderRisk {
  risk: string;
  severity: SkillSeverity;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface AutomationBuilderOutput {
  suggestionsSummary: string;
  suggestedMenuChanges: AutomationBuilderMenuSuggestion[];
  suggestedEscalationChanges: AutomationBuilderEscalationSuggestion[];
  risks: AutomationBuilderRisk[];
}
