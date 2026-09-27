/**
 * packages/ai-skills/src/onboarding-cro/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { OnboardingCroInput, OnboardingCroOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateOnboardingCroInput(
  input: OnboardingCroInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.tenantName?.trim()) errors.push("tenantName is required");
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    errors.push("steps must contain at least 1 item");
  }

  return { valid: errors.length === 0, errors };
}

export function validateOnboardingCroOutput(
  output: OnboardingCroOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.progressSummary?.trim()) errors.push("progressSummary must not be empty");
  if (typeof output.completedStepsCount !== "number") errors.push("completedStepsCount is required");
  if (typeof output.totalStepsCount !== "number") errors.push("totalStepsCount is required");
  if (!output.nextRecommendedStep?.trim()) errors.push("nextRecommendedStep must not be empty");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions must be a list");

  return { valid: errors.length === 0, errors };
}
