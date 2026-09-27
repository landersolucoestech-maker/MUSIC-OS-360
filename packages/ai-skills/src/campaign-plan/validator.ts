/**
 * packages/ai-skills/src/campaign-plan/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { CampaignPlanInput, CampaignPlanOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateCampaignPlanInput(
  input: CampaignPlanInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName is required");
  if (!input.campaignType?.trim()) errors.push("campaignType is required");

  if (input.budget !== undefined) {
    if (typeof input.budget !== "number" || Number.isNaN(input.budget) || !Number.isFinite(input.budget) || input.budget < 0) {
      errors.push("budget, if provided, must be a valid number >= 0");
    }
  }

  if (input.platforms !== undefined && !Array.isArray(input.platforms)) {
    errors.push("platforms must be an array");
  }

  return { valid: errors.length === 0, errors };
}

export function validateCampaignPlanOutput(
  output: CampaignPlanOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.planSummary?.trim()) errors.push("planSummary must not be empty");
  if (!Array.isArray(output.channels)) errors.push("channels must be a list");
  if (!Array.isArray(output.suggestedTasks)) errors.push("suggestedTasks must be a list");

  return { valid: errors.length === 0, errors };
}
