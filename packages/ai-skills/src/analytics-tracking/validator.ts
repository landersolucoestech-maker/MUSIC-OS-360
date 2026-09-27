/**
 * packages/ai-skills/src/analytics-tracking/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { AnalyticsTrackingInput, AnalyticsTrackingOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateAnalyticsTrackingInput(
  input: AnalyticsTrackingInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.providerName?.trim()) errors.push("providerName is required");
  if (input.providerState !== "configured" && input.providerState !== "configuration_required") {
    errors.push("providerState must be 'configured' or 'configuration_required'");
  }
  if (typeof input.totalCanonicalEvents !== "number") errors.push("totalCanonicalEvents is required");
  if (!Array.isArray(input.coverage)) errors.push("coverage must be a list");

  return { valid: errors.length === 0, errors };
}

export function validateAnalyticsTrackingOutput(
  output: AnalyticsTrackingOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.coverageSummary?.trim()) errors.push("coverageSummary must not be empty");
  if (typeof output.coveragePercentage !== "number") errors.push("coveragePercentage is required");
  if (!Array.isArray(output.gaps)) errors.push("gaps must be a list");
  if (!Array.isArray(output.recommendations)) errors.push("recommendations must be a list");

  return { valid: errors.length === 0, errors };
}
