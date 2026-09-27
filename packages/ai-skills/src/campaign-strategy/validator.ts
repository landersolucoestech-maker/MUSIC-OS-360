/**
 * packages/ai-skills/src/campaign-strategy/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { CampaignStrategyInput, CampaignStrategyOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateCampaignStrategyInput(
  input: CampaignStrategyInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName is required");
  if (!input.campaignType?.trim()) errors.push("campaignType is required");

  return { valid: errors.length === 0, errors };
}

export function validateCampaignStrategyOutput(
  output: CampaignStrategyOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.strategicDirection?.trim()) errors.push("strategicDirection must not be empty");
  if (!output.targetAudience?.trim())     errors.push("targetAudience must not be empty");
  if (!Array.isArray(output.keyMessages)) errors.push("keyMessages must be a list");

  return { valid: errors.length === 0, errors };
}
