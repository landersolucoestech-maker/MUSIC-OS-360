/**
 * packages/ai-skills/src/onboarding-cro/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { OnboardingCroInput, OnboardingCroOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateOnboardingCroInput(
  input: OnboardingCroInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.tenantName?.trim()) errors.push("tenantName é obrigatório");
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    errors.push("steps deve conter ao menos 1 item");
  }

  return { valid: errors.length === 0, errors };
}

export function validateOnboardingCroOutput(
  output: OnboardingCroOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.progressSummary?.trim()) errors.push("progressSummary não pode estar vazio");
  if (typeof output.completedStepsCount !== "number") errors.push("completedStepsCount é obrigatório");
  if (typeof output.totalStepsCount !== "number") errors.push("totalStepsCount é obrigatório");
  if (!output.nextRecommendedStep?.trim()) errors.push("nextRecommendedStep não pode estar vazio");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
