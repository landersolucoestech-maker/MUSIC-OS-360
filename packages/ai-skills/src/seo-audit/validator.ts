/**
 * packages/ai-skills/src/seo-audit/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 * Valida também a garantia anti-fabricação: nenhum check pode ter
 * source="external_measurement" (nenhuma medição externa é executada por
 * esta skill).
 */

import type { SeoAuditInput, SeoAuditOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateSeoAuditInput(
  input: SeoAuditInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName é obrigatório");
  if (!input.promotedEntityType?.trim()) errors.push("promotedEntityType é obrigatório");
  if (!input.promotedEntityName?.trim()) errors.push("promotedEntityName é obrigatório");
  if (typeof input.hasUtm !== "boolean") errors.push("hasUtm é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validateSeoAuditOutput(
  output: SeoAuditOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.auditSummary?.trim()) errors.push("auditSummary não pode estar vazio");
  if (!Array.isArray(output.checks)) errors.push("checks deve ser uma lista");
  else if (output.checks.some((c) => c.source === "external_measurement")) {
    errors.push("nenhum check pode ter source=external_measurement — anti-fabricação (esta skill não mede nada externo)");
  }
  if (!Array.isArray(output.unavailableMetrics)) errors.push("unavailableMetrics deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
