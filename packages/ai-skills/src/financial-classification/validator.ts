/**
 * packages/ai-skills/src/financial-classification/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type {
  FinancialClassificationInput,
  FinancialClassificationOutput,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export type ValidationResult = SkillValidationResult;

export function validateFinancialClassificationInput(
  input: FinancialClassificationInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.description?.trim()) errors.push("description é obrigatório");

  if (typeof input.amount !== "number" || Number.isNaN(input.amount) || !Number.isFinite(input.amount)) {
    errors.push("amount é obrigatório e deve ser um número válido");
  }

  if (input.direction !== "income" && input.direction !== "expense") {
    errors.push('direction é obrigatório e deve ser "income" ou "expense"');
  }

  return { valid: errors.length === 0, errors };
}

export function validateFinancialClassificationOutput(
  output: FinancialClassificationOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.category?.trim())   errors.push("category não pode estar vazio");
  if (!output.costCenter?.trim()) errors.push("costCenter não pode estar vazio");

  if (typeof output.confidence !== "number") {
    errors.push("confidence deve ser numérico");
  } else if (output.confidence < 0 || output.confidence > 1) {
    errors.push("confidence deve estar entre 0 e 1");
  }

  return { valid: errors.length === 0, errors };
}
