/**
 * packages/ai-skills/src/contact-operations/contracts.ts
 *
 * Contracts of the contact-operations skill (version 1.0.0).
 * Operational onboarding checklist for a CLIENT newly created from a lead
 * conversion — a lifecycle moment distinct from the one already covered by
 * crm-followup (which acts on `lead.created`, before conversion, suggesting how
 * to close the deal). contact-operations acts AFTER conversion, on
 * `client.created`, suggesting how to operationalize the new client relationship
 * (ClientEntity/`clients` table — "Contato" and "Cliente" are the same physical
 * entity, see contacts.service.ts).
 *
 * Data source: only real, persisted ClientEntity fields (nome, categoria,
 * tipo_pessoa, responsavel_nome). It does NOT depend on ContactTimelineService
 * (contact-timeline module — an in-memory Map, never persisted, not a real data
 * source) nor on ClientEntity.interacoes (a declared column no real flow ever
 * writes).
 */

import type { SkillLanguage, SkillPriority } from "../shared/primitives";

export type ContactOperationsLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ContactOperationsInput {
  clientName: string;
  clientCategory: string;
  clientTipoPessoa: string;
  responsavelNome?: string;
  sourceLeadId?: string;
  context?: string;
  language?: ContactOperationsLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface ContactOperationsAction {
  action: string;
  priority: SkillPriority;
}

export interface ContactOperationsGap {
  gap: string;
  reason: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface ContactOperationsOutput {
  onboardingSummary: string;
  recommendedActions: ContactOperationsAction[];
  dataGaps: ContactOperationsGap[];
}
