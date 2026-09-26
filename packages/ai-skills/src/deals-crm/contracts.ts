/**
 * packages/ai-skills/src/deals-crm/contracts.ts
 *
 * Contracts of the deals-crm skill (version 1.0.0).
 * Analysis of a client's sales pipeline (deals) — from the real CONTRACTS
 * already linked to it (ContractEntity.client_id, ClientsService.getContracts())
 * — never from the `pipelines`/`pipeline_opportunities` schema (it exists but
 * explicitly has no audited contract — see
 * apps/api/src/modules/reports/pipeline-forms-not-reportable.guard.spec.ts — and
 * no real service/controller/frontend at all).
 *
 * "Deal" = contract (this product's real business unit — it has a real money
 * value (`valor`), a status with a real lifecycle (ContractStatus) and a linked
 * client). dealStage is DERIVED deterministically from the real ContractStatus
 * in the automation code (never by the model) — see
 * mapContractStatusToDealStage() in the automation layer.
 *
 * ANTI-FABRICATION: each deal's value is echoed straight from the real
 * `contracts.valor` field (nullable) — never invented; when absent, the deal is
 * flagged with value=null and the skill NEVER proposes a value. The model is
 * never allowed to change dealStage/value — it only narrates and recommends.
 *
 * Execution: ON_DEMAND, triggered by the user on the client screen.
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

// ─── Output blocks ────────────────────────────────────────────────────────────

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
