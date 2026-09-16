/**
 * packages/ai-skills/src/social-content/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { SocialContentInput, SocialContentOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateSocialContentInput(
  input: SocialContentInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.title?.trim()) errors.push("title é obrigatório");
  if (!input.targetType?.trim()) errors.push("targetType é obrigatório");
  if (!input.targetName?.trim()) errors.push("targetName é obrigatório");
  if (!input.channel?.trim()) errors.push("channel é obrigatório");
  if (!input.contentType?.trim()) errors.push("contentType é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validateSocialContentOutput(
  output: SocialContentOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(output.captionVariants) || output.captionVariants.length === 0) {
    errors.push("captionVariants deve conter ao menos 1 item");
  }
  if (!Array.isArray(output.hashtags)) errors.push("hashtags deve ser uma lista");
  if (!output.toneNotes?.trim()) errors.push("toneNotes não pode estar vazio");
  if (!Array.isArray(output.channelChecklist)) errors.push("channelChecklist deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
