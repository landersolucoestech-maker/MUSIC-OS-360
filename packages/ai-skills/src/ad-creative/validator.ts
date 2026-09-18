/**
 * packages/ai-skills/src/ad-creative/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { AdCreativeInput, AdCreativeOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateAdCreativeInput(
  input: AdCreativeInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName é obrigatório");
  if (!input.objective?.trim()) errors.push("objective é obrigatório");
  if (!input.promotedEntityType?.trim()) errors.push("promotedEntityType é obrigatório");
  if (!input.promotedEntityName?.trim()) errors.push("promotedEntityName é obrigatório");
  if (!input.platform?.trim()) errors.push("platform é obrigatório");
  if (!input.placement?.trim()) errors.push("placement é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validateAdCreativeOutput(
  output: AdCreativeOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.creativeSummary?.trim()) errors.push("creativeSummary não pode estar vazio");
  if (!Array.isArray(output.variants) || output.variants.length === 0) {
    errors.push("variants deve conter ao menos 1 item");
  }
  if (!output.platformNotes?.trim()) errors.push("platformNotes não pode estar vazio");
  if (!Array.isArray(output.risks)) errors.push("risks deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
