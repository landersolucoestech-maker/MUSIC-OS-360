/**
 * packages/ai-skills/src/automation-builder/contracts.ts
 *
 * Contratos da skill automation-builder (version 1.0.0).
 * Sugestões de melhoria para a configuração de automação do MusicChat
 * (menu de triagem, regras de escalonamento) a partir de padrões REAIS de
 * uso — nunca cria nem modifica `musicchat_automation_settings`
 * automaticamente. A skill produz apenas SUGESTÕES; qualquer mudança real
 * de configuração exige a ação humana explícita em
 * `PATCH /conversations/musicchat/automation/settings` (endpoint já
 * existente, inalterado por esta skill).
 *
 * Execução: ON_DEMAND, disparada por ação explícita do usuário — nunca
 * automaticamente ao detectar mudança de dados.
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

// ─── Blocos de saída ──────────────────────────────────────────────────────────

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
