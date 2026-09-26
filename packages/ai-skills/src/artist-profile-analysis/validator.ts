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

  if (!input.artistName?.trim()) errors.push("artistName é obrigatório");

  if (input.platforms !== undefined) {
    if (!Array.isArray(input.platforms)) {
      errors.push("platforms deve ser um array");
    } else {
      const invalidFollowers = input.platforms.some(
        (p) =>
          p.followers !== undefined &&
          (typeof p.followers !== "number" || Number.isNaN(p.followers) || !Number.isFinite(p.followers) || p.followers < 0),
      );
      if (invalidFollowers) errors.push("followers, se informado, deve ser um número válido >= 0");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateArtistProfileAnalysisOutput(
  output: ArtistProfileAnalysisOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.positioning?.trim())    errors.push("positioning não pode estar vazio");
  if (!output.brandNarrative?.trim()) errors.push("brandNarrative não pode estar vazio");
  if (!Array.isArray(output.opportunities)) errors.push("opportunities deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
