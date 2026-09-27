/**
 * packages/ai-skills/src/artist-profile-analysis/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type {
  ArtistProfileAnalysisInput,
  ArtistProfileAnalysisOutput,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export type ValidationResult = SkillValidationResult;

export function validateArtistProfileAnalysisInput(
  input: ArtistProfileAnalysisInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.artistName?.trim()) errors.push("artistName is required");

  if (input.platforms !== undefined) {
    if (!Array.isArray(input.platforms)) {
      errors.push("platforms must be an array");
    } else {
      const invalidFollowers = input.platforms.some(
        (p) =>
          p.followers !== undefined &&
          (typeof p.followers !== "number" || Number.isNaN(p.followers) || !Number.isFinite(p.followers) || p.followers < 0),
      );
      if (invalidFollowers) errors.push("followers, if provided, must be a valid number >= 0");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateArtistProfileAnalysisOutput(
  output: ArtistProfileAnalysisOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.positioning?.trim())    errors.push("positioning must not be empty");
  if (!output.brandNarrative?.trim()) errors.push("brandNarrative must not be empty");
  if (!Array.isArray(output.opportunities)) errors.push("opportunities must be a list");

  return { valid: errors.length === 0, errors };
}
