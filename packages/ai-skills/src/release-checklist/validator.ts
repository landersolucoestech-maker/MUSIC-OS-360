/**
 * packages/ai-skills/src/release-checklist/validator.ts
 */

import type {
  ReleaseChecklistInput,
  ReleaseChecklistOutput,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export type ValidationResult = SkillValidationResult;

export function validateReleaseChecklistInput(input: ReleaseChecklistInput): SkillValidationResult {
  const errors: string[] = [];

  if (!input.releaseTitle?.trim()) errors.push("releaseTitle is required");
  if (!input.artistName?.trim())   errors.push("artistName is required");
  if (!input.releaseType)          errors.push("releaseType is required");

  const booleanFields: Array<keyof ReleaseChecklistInput> = [
    "hasCover",
    "hasIsrc",
    "hasUpc",
    "hasContracts",
    "hasSplits",
    "hasMarketingPlan",
  ];

  for (const field of booleanFields) {
    if (typeof input[field] !== "boolean") {
      errors.push(`${field} must be a boolean`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateReleaseChecklistOutput(output: ReleaseChecklistOutput): SkillValidationResult {
  const errors: string[] = [];

  if (typeof output.readinessScore !== "number") {
    errors.push("readinessScore must be numeric");
  } else if (output.readinessScore < 0 || output.readinessScore > 100) {
    errors.push("readinessScore must be between 0 and 100");
  }

  if (!output.status) errors.push("status must not be empty");
  if (!Array.isArray(output.checklist)) errors.push("checklist must be a list");

  return { valid: errors.length === 0, errors };
}
