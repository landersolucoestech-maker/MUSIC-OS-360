/**
 * packages/ai-skills/src/paid-ads/contracts.ts
 *
 * Contratos da skill paid-ads (version 1.0.0).
 * Sugestão de alocação de orçamento e posicionamento entre plataformas de
 * mídia paga para uma campanha JÁ EM RASCUNHO no Campaign Builder real
 * (MarketingCampaignBuilderService/CampaignEntity com type='marketing_builder').
 *
 * Distinção de escopo: ad-creative sugere o TEXTO do criativo para uma
 * plataforma/posicionamento específicos; paid-ads sugere COMO distribuir o
 * orçamento ENTRE as plataformas selecionadas (o campo real
 * CampaignBudget.platformSplit) e quais posicionamentos priorizar — não se
 * sobrepõem. Nenhuma das duas lança/gerencia anúncios: o backend real já
 * declara `/publish` como stub self-documented e todo provedor de ads como
 * `available: false` (marketing-integration.contract.ts).
 *
 * ANTI-FABRICAÇÃO: esta skill NUNCA produz uma previsão numérica de
 * desempenho (CPA, ROAS, CTR estimado) — apenas percentuais de alocação de
 * orçamento (que somam 100%, renormalizados no parser) e recomendações
 * qualitativas. docs/CODEBASE_MAP.md documenta que
 * `estimateCampaignResults()` já fabrica métricas exibidas como reais; esta
 * skill não reproduz esse padrão nem lê/escreve esses campos.
 *
 * Execução: ON_DEMAND, disparada pelo usuário dentro do Campaign Builder.
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type PaidAdsLanguage = SkillLanguage;

export interface PaidAdsPlatformInput {
  platform: string;
  compatiblePlacements: string[];
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface PaidAdsInput {
  campaignName: string;
  objective: string;
  expectedOutcome?: string;
  promotedEntityType: string;
  promotedEntityName: string;
  platforms: PaidAdsPlatformInput[];
  totalBudget?: number;
  dailyBudget?: number;
  currency?: string;
  audienceSummary?: string;
  context?: string;
  language?: PaidAdsLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface PaidAdsPlatformSplit {
  platform: string;
  percentageShare: number;
  rationale: string;
}

export interface PaidAdsPlacementRecommendation {
  platform: string;
  placement: string;
  rationale: string;
}

export interface PaidAdsRisk {
  risk: string;
  severity: SkillSeverity;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface PaidAdsOutput {
  strategySummary: string;
  platformSplit: PaidAdsPlatformSplit[];
  placementRecommendations: PaidAdsPlacementRecommendation[];
  budgetNotes: string;
  risks: PaidAdsRisk[];
}
