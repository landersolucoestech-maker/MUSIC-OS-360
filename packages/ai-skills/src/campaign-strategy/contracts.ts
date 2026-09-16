/**
 * packages/ai-skills/src/campaign-strategy/contracts.ts
 *
 * Contratos da skill campaign-strategy (version 1.0.0).
 * Direção estratégica de uma campanha no momento em que ela entra em
 * execução — posicionamento, público-alvo, mensagens-chave e sinais a
 * observar para ajuste de rota. Fonte canônica compartilhada (web + api).
 *
 * Distinção de escopo dentro do cluster de campanhas — ver
 * campaign-plan/contracts.ts para o quadro completo. Esta skill NÃO
 * recomenda canais/orçamento/tarefas (isso é campaign-plan) e NÃO relata
 * resultados (isso é campaign-report); ela define COMO comunicar e O QUE
 * observar enquanto a campanha roda.
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type CampaignStrategyLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CampaignStrategyInput {
  campaignName: string;
  campaignType: string;
  objective?: string;
  relatedArtist?: string;
  startDate?: string;
  endDate?: string;
  existingPlanSummary?: string;
  context?: string;
  language?: CampaignStrategyLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface CampaignKeyMessage {
  message: string;
  audience: string;
}

export interface CampaignMetricToWatch {
  metric: string;
  why: string;
}

export interface CampaignAdjustmentTrigger {
  signal: string;
  severity: SkillSeverity;
  response: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CampaignStrategyOutput {
  strategicDirection: string;
  targetAudience: string;
  competitivePositioning: string;
  keyMessages: CampaignKeyMessage[];
  metricsToWatch: CampaignMetricToWatch[];
  adjustmentTriggers: CampaignAdjustmentTrigger[];
}
