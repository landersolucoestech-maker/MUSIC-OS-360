/**
 * packages/ai-skills/src/audience-health/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { AudienceHealthInput, AudienceHealthOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const HEALTH_STATUSES = ["healthy", "attention", "critical", "insufficient_data"];

export function validateAudienceHealthInput(
  input: AudienceHealthInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.artistName?.trim()) errors.push("artistName is required");
  if (input.careerStageStatus !== "OK" && input.careerStageStatus !== "INSUFFICIENT_DATA") {
    errors.push("careerStageStatus must be 'OK' or 'INSUFFICIENT_DATA'");
  }
  if (typeof input.careerStageConfidence !== "number") errors.push("careerStageConfidence is required");
  if (!["READY", "STALE", "REFRESHING", "INTEGRATION_UNAVAILABLE", "ERROR"].includes(input.marketBenchmarkReadStatus)) {
    errors.push("marketBenchmarkReadStatus is invalid");
  }

  return { valid: errors.length === 0, errors };
}

export function validateAudienceHealthOutput(
  output: AudienceHealthOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.healthSummary?.trim()) errors.push("healthSummary must not be empty");
  if (!HEALTH_STATUSES.includes(output.healthStatus)) errors.push("healthStatus is invalid");
  if (!Array.isArray(output.strengths)) errors.push("strengths must be a list");
  if (!Array.isArray(output.concerns)) errors.push("concerns must be a list");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions must be a list");
  if (!Array.isArray(output.dataGaps)) errors.push("dataGaps must be a list");

  return { valid: errors.length === 0, errors };
}
