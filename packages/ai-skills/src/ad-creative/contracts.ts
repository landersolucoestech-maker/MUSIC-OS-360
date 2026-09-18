/**
 * packages/ai-skills/src/ad-creative/contracts.ts
 *
 * Contratos da skill ad-creative (version 1.0.0).
 * Sugestões de criativo (headline/copy/descrição/CTA) para uma campanha de
 * mídia paga JÁ EM RASCUNHO no Campaign Builder real
 * (MarketingCampaignBuilderService/CampaignEntity com type='marketing_builder')
 * — nunca inventa uma campanha nem persiste o criativo diretamente.
 *
 * Escopo deliberadamente restrito à GERAÇÃO de texto de criativo — nunca ao
 * lançamento/publicação (o próprio backend já declara `/publish` como stub
 * self-documented: "Provider-side publishing is not executed by this stub
 * endpoint"; marketing-integration.contract.ts declara `available: false`
 * para todo provedor de ads). Esta skill nunca implica que um anúncio foi
 * veiculado, e nunca produz números de desempenho (reach/clicks/conversions/
 * ROAS) — ver docs/CODEBASE_MAP.md sobre `estimateCampaignResults()` já ser
 * uma métrica fabricada e exibida como real; esta skill não repete esse
 * padrão.
 *
 * Distinção de escopo: paid-ads sugere ALOCAÇÃO de orçamento/plataforma;
 * ad-creative sugere o TEXTO do criativo para UMA plataforma/posicionamento
 * específicos — não se sobrepõem.
 *
 * Execução: ON_DEMAND (ver on-demand-skill.runner.ts), disparada pelo
 * usuário dentro do Campaign Builder — nunca automaticamente.
 */

import type { SkillLanguage, SkillSeverity } from "../shared/primitives";

export type AdCreativeLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AdCreativeInput {
  campaignName: string;
  objective: string;
  expectedOutcome?: string;
  promotedEntityType: string;
  promotedEntityName: string;
  platform: string;
  placement: string;
  destinationUrl?: string;
  audienceSummary?: string;
  context?: string;
  language?: AdCreativeLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface AdCreativeVariant {
  headline: string;
  primaryCopy: string;
  description: string;
  cta: string;
  tone: string;
}

export interface AdCreativeRisk {
  risk: string;
  severity: SkillSeverity;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface AdCreativeOutput {
  creativeSummary: string;
  variants: AdCreativeVariant[];
  platformNotes: string;
  risks: AdCreativeRisk[];
}
