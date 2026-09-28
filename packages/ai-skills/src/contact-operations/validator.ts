/**
 * packages/ai-skills/src/contact-operations/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { ContactOperationsInput, ContactOperationsOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateContactOperationsInput(
  input: ContactOperationsInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.clientName?.trim()) errors.push("clientName is required");
  if (!input.clientCategory?.trim()) errors.push("clientCategory is required");
  if (!input.clientPersonType?.trim()) errors.push("clientPersonType is required");

  return { valid: errors.length === 0, errors };
}

export function validateContactOperationsOutput(
  output: ContactOperationsOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.onboardingSummary?.trim()) errors.push("onboardingSummary must not be empty");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions must be a list");
  if (!Array.isArray(output.dataGaps)) errors.push("dataGaps must be a list");

  return { valid: errors.length === 0, errors };
}
