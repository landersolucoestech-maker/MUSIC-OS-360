/**
 * packages/ai-skills/src/launch-strategy/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { LaunchStrategyInput, LaunchStrategyOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateLaunchStrategyInput(
  input: LaunchStrategyInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.releaseTitle?.trim()) errors.push("releaseTitle is required");
  if (!input.releaseType?.trim()) errors.push("releaseType is required");

  return { valid: errors.length === 0, errors };
}

export function validateLaunchStrategyOutput(
  output: LaunchStrategyOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.strategicNarrative?.trim()) errors.push("strategicNarrative must not be empty");
  if (!output.targetAudience?.trim()) errors.push("targetAudience must not be empty");
  if (!output.competitivePositioning?.trim()) errors.push("competitivePositioning must not be empty");
  if (!Array.isArray(output.keyMessages)) errors.push("keyMessages must be a list");
  if (!Array.isArray(output.successSignals)) errors.push("successSignals must be a list");
  if (!Array.isArray(output.riskFactors)) errors.push("riskFactors must be a list");

  return { valid: errors.length === 0, errors };
}
