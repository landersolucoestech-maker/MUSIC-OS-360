/**
 * packages/ai-skills/src/deals-crm/contracts.ts
 *
 * Contratos da skill deals-crm (version 1.0.0).
 * Análise do pipeline comercial (deals) de um cliente — a partir dos
 * CONTRATOS reais já vinculados a ele (ContractEntity.client_id,
 * ClientsService.getContracts()) — nunca sobre o esquema
 * `pipelines`/`pipeline_opportunities` (schema existe mas está
 * explicitamente sem contrato auditado — ver
 * apps/api/src/modules/reports/pipeline-forms-not-reportable.guard.spec.ts —
 * e sem service/controller/frontend real algum).
 *
 * "Deal" = contrato (a unidade comercial real deste produto — tem valor
 * monetário real (`valor`), status com ciclo de vida real (ContractStatus),
 * cliente vinculado). dealStage é DERIVADO deterministicamente do
 * ContractStatus real no código da automação (nunca pelo modelo) — ver
 * mapContractStatusToDealStage() no automation layer.
 *
 * ANTI-FABRICAÇÃO: o valor de cada deal é ecoado diretamente do campo real
 * `contracts.valor` (nullable) — nunca inventado; quando ausente, o deal é
 * marcado com value=null e a skill NUNCA propõe um valor. O modelo nunca
 * recebe permissão de alterar dealStage/value — apenas narra e recomenda.
 *
 * Execução: ON_DEMAND, disparada pelo usuário na tela do cliente.
 */

import type { SkillLanguage, SkillPriority, SkillSeverity } from "../shared/primitives";

export type DealsCrmLanguage = SkillLanguage;

export type DealStage = "open" | "won" | "at_risk" | "lost";

export interface DealsCrmDeal {
  title: string;
  type: string;
  stage: DealStage;
  value: number | null;
  startDate?: string;
  endDate?: string;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface DealsCrmInput {
  clientName: string;
  clientCategory: string;
  deals: DealsCrmDeal[];
  context?: string;
  language?: DealsCrmLanguage;
}

// ─── Blocos de saída ──────────────────────────────────────────────────────────

export interface DealsCrmAction {
  action: string;
  priority: SkillPriority;
}

export interface DealsCrmRisk {
  risk: string;
  severity: SkillSeverity;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface DealsCrmOutput {
  pipelineSummary: string;
  recommendedActions: DealsCrmAction[];
  risks: DealsCrmRisk[];
}
