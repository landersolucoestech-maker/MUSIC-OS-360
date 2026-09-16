/**
 * packages/ai-skills/src/campaign-plan/contracts.ts
 *
 * Contratos da skill campaign-plan (version 1.0.0).
 * Plano tático inicial de uma campanha de marketing recém-criada — canais,
 * alocação de orçamento, marcos de cronograma e tarefas sugeridas.
 * Fonte canônica compartilhada (web + api).
 *
 * Distinção de escopo dentro do cluster de campanhas:
 *   campaign-plan     (campaign.created) — plano tático inicial, ANTES de a
 *                      campanha começar a rodar.
 *   campaign-strategy (campaign.started) — direção estratégica/posicionamento
 *                      no momento em que a campanha entra em execução.
 *   campaign-report   (campaign.ended)   — retrospectiva de execução ao final.
 */

import type { SkillLanguage, SkillPriority, SkillSeverity } from "../shared/primitives";

export type CampaignPlanLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CampaignPlanInput {
  campaignName: string;
  campaignType: string;
  objective?: string;
  budget?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  relatedArtist?: string;
  platforms?: string[];
  context?: string;
  language?: CampaignPlanLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface CampaignPlanChannel {
  channel: string;
  rationale: string;
  suggestedBudgetSharePercent: number;
}

export interface CampaignPlanMilestone {
  milestone: string;
  timing: string;
}

export interface CampaignPlanTask {
  task: string;
  area: string;
  priority: SkillPriority;
}

export interface CampaignPlanRisk {
  risk: string;
  severity: SkillSeverity;
  mitigation: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CampaignPlanOutput {
  planSummary: string;
  channels: CampaignPlanChannel[];
  milestones: CampaignPlanMilestone[];
  suggestedTasks: CampaignPlanTask[];
  risks: CampaignPlanRisk[];
  budgetNotes: string;
}
