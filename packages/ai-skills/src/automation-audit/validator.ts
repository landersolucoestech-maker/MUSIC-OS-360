/**
 * packages/ai-skills/src/automation-audit/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { AutomationAuditInput, AutomationAuditOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const HEALTH_STATUSES = ["healthy", "attention", "critical"];

export function validateAutomationAuditInput(
  input: AutomationAuditInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (typeof input.automationEnabled !== "boolean") errors.push("automationEnabled é obrigatório");
  if (typeof input.totalEventsAnalyzed !== "number") errors.push("totalEventsAnalyzed é obrigatório");
  if (!Array.isArray(input.eventCounts)) errors.push("eventCounts deve ser uma lista");

  return { valid: errors.length === 0, errors };
}

export function validateAutomationAuditOutput(
  output: AutomationAuditOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.auditSummary?.trim()) errors.push("auditSummary não pode estar vazio");
  if (!HEALTH_STATUSES.includes(output.healthStatus)) errors.push("healthStatus inválido");
  if (!Array.isArray(output.findings)) errors.push("findings deve ser uma lista");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
