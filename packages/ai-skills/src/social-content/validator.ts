/**
 * packages/ai-skills/src/social-content/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { SocialContentInput, SocialContentOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateSocialContentInput(
  input: SocialContentInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.title?.trim()) errors.push("title is required");
  if (!input.targetType?.trim()) errors.push("targetType is required");
  if (!input.targetName?.trim()) errors.push("targetName is required");
  if (!input.channel?.trim()) errors.push("channel is required");
  if (!input.contentType?.trim()) errors.push("contentType is required");

  return { valid: errors.length === 0, errors };
}

export function validateSocialContentOutput(
  output: SocialContentOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(output.captionVariants) || output.captionVariants.length === 0) {
    errors.push("captionVariants must contain at least 1 item");
  }
  if (!Array.isArray(output.hashtags)) errors.push("hashtags must be a list");
  if (!output.toneNotes?.trim()) errors.push("toneNotes must not be empty");
  if (!Array.isArray(output.channelChecklist)) errors.push("channelChecklist must be a list");

  return { valid: errors.length === 0, errors };
}
