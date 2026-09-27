/**
 * packages/ai-skills/src/catalog-metadata-validator/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 * Blocking rules (errors) live here; non-blocking notices (ISRC missing on a
 * recording, shares sum ≠ 100) are handled by the parser/fallback as warnings.
 */

import type {
  CatalogMetadataValidatorInput,
  CatalogMetadataValidatorOutput,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export type ValidationResult = SkillValidationResult;

export function validateCatalogMetadataValidatorInput(
  input: CatalogMetadataValidatorInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.title?.trim()) errors.push("title is required");

  if (input.type !== "work" && input.type !== "recording") {
    errors.push('type is required and must be "work" or "recording"');
  }

  if (input.type === "work") {
    if (!Array.isArray(input.composers) || input.composers.length === 0) {
      errors.push("composers must have at least 1 item for type=work");
    }
  }

  if (input.type === "recording") {
    if (!Array.isArray(input.performers) || input.performers.length === 0) {
      errors.push("performers must have at least 1 item for type=recording");
    }
  }

  if (input.shares !== undefined) {
    if (!Array.isArray(input.shares)) {
      errors.push("shares must be a list");
    } else {
      const invalid = input.shares.some((s) => typeof s.percentage !== "number" || Number.isNaN(s.percentage));
      if (invalid) errors.push("each share.percentage must be a number");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateCatalogMetadataValidatorOutput(
  output: CatalogMetadataValidatorOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (typeof output.isValid !== "boolean") errors.push("isValid must be a boolean");

  if (typeof output.score !== "number") {
    errors.push("score must be numeric");
  } else if (output.score < 0 || output.score > 100) {
    errors.push("score must be between 0 and 100");
  }

  if (!Array.isArray(output.errors))   errors.push("errors must be a list");
  if (!Array.isArray(output.warnings)) errors.push("warnings must be a list");

  return { valid: errors.length === 0, errors };
}
