/**
 * skills/audiovisual-briefing/validators/audiovisual-briefing.validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type {
  AudiovisualBriefingInput,
  AudiovisualBriefingOutput,
  AudiovisualContentType,
  AudiovisualBudgetLevel,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const CONTENT_TYPES: AudiovisualContentType[] = [
  "music-video", "lyric-video", "visualizer", "teaser",
  "reels", "shorts", "stories", "institutional", "other",
];

const BUDGET_LEVELS: AudiovisualBudgetLevel[] = ["low", "medium", "high", "premium"];

export function validateAudiovisualBriefingInput(
  input: AudiovisualBriefingInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.projectTitle?.trim()) errors.push("projectTitle is required");
  if (!input.artistName?.trim())   errors.push("artistName is required");

  if (!input.contentType || !(CONTENT_TYPES as string[]).includes(input.contentType)) {
    errors.push("contentType is required and must be one of the defined values");
  }

  if (!input.objective?.trim()) errors.push("objective is required");

  if (!input.budgetLevel || !(BUDGET_LEVELS as string[]).includes(input.budgetLevel)) {
    errors.push("budgetLevel is required and must be one of the defined values");
  }

  return { valid: errors.length === 0, errors };
}

export function validateAudiovisualBriefingOutput(
  output: AudiovisualBriefingOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.creativeConcept?.trim())     errors.push("creativeConcept must not be empty");
  if (!Array.isArray(output.script))       errors.push("script must be a list");
  if (!Array.isArray(output.deliverables)) errors.push("deliverables must be a list");

  return { valid: errors.length === 0, errors };
}
