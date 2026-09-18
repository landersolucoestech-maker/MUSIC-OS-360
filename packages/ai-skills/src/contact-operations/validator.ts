/**
 * packages/ai-skills/src/contact-operations/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { ContactOperationsInput, ContactOperationsOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateContactOperationsInput(
  input: ContactOperationsInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.clientName?.trim()) errors.push("clientName é obrigatório");
  if (!input.clientCategory?.trim()) errors.push("clientCategory é obrigatório");
  if (!input.clientTipoPessoa?.trim()) errors.push("clientTipoPessoa é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validateContactOperationsOutput(
  output: ContactOperationsOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.onboardingSummary?.trim()) errors.push("onboardingSummary não pode estar vazio");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions deve ser uma lista");
  if (!Array.isArray(output.dataGaps)) errors.push("dataGaps deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
