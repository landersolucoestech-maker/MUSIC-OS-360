/**
 * packages/ai-skills/src/ad-creative/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { AdCreativeInput, AdCreativeOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateAdCreativeInput(
  input: AdCreativeInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName is required");
  if (!input.objective?.trim()) errors.push("objective is required");
  if (!input.promotedEntityType?.trim()) errors.push("promotedEntityType is required");
  if (!input.promotedEntityName?.trim()) errors.push("promotedEntityName is required");
  if (!input.platform?.trim()) errors.push("platform is required");
  if (!input.placement?.trim()) errors.push("placement is required");

  return { valid: errors.length === 0, errors };
}

export function validateAdCreativeOutput(
  output: AdCreativeOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.creativeSummary?.trim()) errors.push("creativeSummary must not be empty");
  if (!Array.isArray(output.variants) || output.variants.length === 0) {
    errors.push("variants must contain at least 1 item");
  }
  if (!output.platformNotes?.trim()) errors.push("platformNotes must not be empty");
  if (!Array.isArray(output.risks)) errors.push("risks must be a list");

  return { valid: errors.length === 0, errors };
}
