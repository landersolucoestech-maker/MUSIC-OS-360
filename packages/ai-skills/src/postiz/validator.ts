/**
 * packages/ai-skills/src/postiz/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 * Also validates the anti-fabrication guarantee: readyToRequestPublish cannot be
 * true when channelReadiness (input) is not "connected" or hasCopy is false —
 * the parser enforces this regardless of what the model says (the automation
 * runner does not call validateOutput; this validation is the safety net for
 * direct callers).
 */

import type { PostizInput, PostizOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const READINESS_VALUES = [
  "dependency_not_met",
  "available_not_connected",
  "connected",
  "requires_reauth",
  "provider_error",
  "not_implemented",
];

export function validatePostizInput(
  input: PostizInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.postTitle?.trim()) errors.push("postTitle é obrigatório");
  if (!input.channel?.trim()) errors.push("channel é obrigatório");
  if (!READINESS_VALUES.includes(input.channelReadiness)) errors.push("channelReadiness inválido");
  if (typeof input.hasCopy !== "boolean") errors.push("hasCopy é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validatePostizOutput(
  output: PostizOutput,
  input?: PostizInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.readinessSummary?.trim()) errors.push("readinessSummary não pode estar vazio");
  if (typeof output.readyToRequestPublish !== "boolean") errors.push("readyToRequestPublish é obrigatório");
  if (!Array.isArray(output.blockers)) errors.push("blockers deve ser uma lista");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions deve ser uma lista");

  if (input && output.readyToRequestPublish) {
    if (input.channelReadiness !== "connected" || !input.hasCopy) {
      errors.push("readyToRequestPublish não pode ser true sem channel conectado e copy presente — anti-fabricação");
    }
  }

  return { valid: errors.length === 0, errors };
}
