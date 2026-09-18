/**
 * packages/ai-skills/src/contact-operations/contracts.ts
 *
 * Contratos da skill contact-operations (version 1.0.0).
 * Checklist operacional de onboarding para um CLIENTE recém-criado a partir
 * da conversão de um lead — momento do ciclo de vida distinto do já coberto
 * por crm-followup (que atua em `lead.created`, antes da conversão,
 * sugerindo como fechar o negócio). contact-operations atua DEPOIS da
 * conversão, em `client.created`, sugerindo como operacionalizar a nova
 * relação com o cliente (ClientEntity/tabela `clients` — "Contato" e
 * "Cliente" são a mesma entidade física, ver contacts.service.ts).
 *
 * Fonte de dados: apenas campos reais e persistidos de ClientEntity
 * (nome, categoria, tipo_pessoa, responsavel_nome). NÃO depende de
 * ContactTimelineService (módulo contact-timeline — Map em memória, nunca
 * persistido, não é fonte de dado real) nem de ClientEntity.interacoes
 * (coluna declarada mas nunca escrita por nenhum fluxo real).
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

// ─── Blocos de saída ──────────────────────────────────────────────────────────

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
