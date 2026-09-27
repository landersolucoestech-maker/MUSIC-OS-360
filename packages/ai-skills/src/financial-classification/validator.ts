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

  if (!input.description?.trim()) errors.push("description is required");

  if (typeof input.amount !== "number" || Number.isNaN(input.amount) || !Number.isFinite(input.amount)) {
    errors.push("amount is required and must be a valid number");
  }

  if (input.direction !== "income" && input.direction !== "expense") {
    errors.push('direction is required and must be "income" or "expense"');
  }

  return { valid: errors.length === 0, errors };
}

export function validateFinancialClassificationOutput(
  output: FinancialClassificationOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.category?.trim())   errors.push("category must not be empty");
  if (!output.costCenter?.trim()) errors.push("costCenter must not be empty");

  if (typeof output.confidence !== "number") {
    errors.push("confidence must be numeric");
  } else if (output.confidence < 0 || output.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }

  return { valid: errors.length === 0, errors };
}
