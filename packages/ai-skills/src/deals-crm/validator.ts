/**
 * packages/ai-skills/src/deals-crm/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { DealsCrmInput, DealsCrmOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateDealsCrmInput(
  input: DealsCrmInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.clientName?.trim()) errors.push("clientName é obrigatório");
  if (!input.clientCategory?.trim()) errors.push("clientCategory é obrigatório");
  if (!Array.isArray(input.deals)) errors.push("deals deve ser uma lista");

  return { valid: errors.length === 0, errors };
}

export function validateDealsCrmOutput(
  output: DealsCrmOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.pipelineSummary?.trim()) errors.push("pipelineSummary não pode estar vazio");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions deve ser uma lista");
  if (!Array.isArray(output.risks)) errors.push("risks deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
