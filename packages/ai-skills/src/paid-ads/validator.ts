/**
 * packages/ai-skills/src/paid-ads/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { PaidAdsInput, PaidAdsOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validatePaidAdsInput(
  input: PaidAdsInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName is required");
  if (!input.objective?.trim()) errors.push("objective is required");
  if (!input.promotedEntityType?.trim()) errors.push("promotedEntityType is required");
  if (!input.promotedEntityName?.trim()) errors.push("promotedEntityName is required");
  if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
    errors.push("platforms must contain at least 1 platform");
  }

  return { valid: errors.length === 0, errors };
}

export function validatePaidAdsOutput(
  output: PaidAdsOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.strategySummary?.trim()) errors.push("strategySummary must not be empty");
  if (!Array.isArray(output.platformSplit) || output.platformSplit.length === 0) {
    errors.push("platformSplit must contain at least 1 item");
  } else {
    const sum = output.platformSplit.reduce((acc, p) => acc + p.percentageShare, 0);
    if (Math.round(sum) !== 100) errors.push(`platformSplit must add up to 100 (current sum: ${sum})`);
  }
  if (!Array.isArray(output.placementRecommendations)) errors.push("placementRecommendations must be a list");
  if (!Array.isArray(output.risks)) errors.push("risks must be a list");

  return { valid: errors.length === 0, errors };
}
