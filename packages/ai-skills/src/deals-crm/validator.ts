/**
 * packages/ai-skills/src/deals-crm/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { DealsCrmInput, DealsCrmOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateDealsCrmInput(
  input: DealsCrmInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.clientName?.trim()) errors.push("clientName is required");
  if (!input.clientCategory?.trim()) errors.push("clientCategory is required");
  if (!Array.isArray(input.deals)) errors.push("deals must be a list");

  return { valid: errors.length === 0, errors };
}

export function validateDealsCrmOutput(
  output: DealsCrmOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.pipelineSummary?.trim()) errors.push("pipelineSummary must not be empty");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions must be a list");
  if (!Array.isArray(output.risks)) errors.push("risks must be a list");

  return { valid: errors.length === 0, errors };
}
