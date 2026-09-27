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

  if (!input.postTitle?.trim()) errors.push("postTitle is required");
  if (!input.channel?.trim()) errors.push("channel is required");
  if (!READINESS_VALUES.includes(input.channelReadiness)) errors.push("channelReadiness is invalid");
  if (typeof input.hasCopy !== "boolean") errors.push("hasCopy is required");

  return { valid: errors.length === 0, errors };
}

export function validatePostizOutput(
  output: PostizOutput,
  input?: PostizInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.readinessSummary?.trim()) errors.push("readinessSummary must not be empty");
  if (typeof output.readyToRequestPublish !== "boolean") errors.push("readyToRequestPublish is required");
  if (!Array.isArray(output.blockers)) errors.push("blockers must be a list");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions must be a list");

  if (input && output.readyToRequestPublish) {
    if (input.channelReadiness !== "connected" || !input.hasCopy) {
      errors.push("readyToRequestPublish cannot be true without a connected channel and existing copy — anti-fabrication");
    }
  }

  return { valid: errors.length === 0, errors };
}
