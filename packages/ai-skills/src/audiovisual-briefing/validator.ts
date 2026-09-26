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

  if (!input.projectTitle?.trim()) errors.push("projectTitle é obrigatório");
  if (!input.artistName?.trim())   errors.push("artistName é obrigatório");

  if (!input.contentType || !(CONTENT_TYPES as string[]).includes(input.contentType)) {
    errors.push("contentType é obrigatório e deve ser um dos valores definidos");
  }

  if (!input.objective?.trim()) errors.push("objective é obrigatório");

  if (!input.budgetLevel || !(BUDGET_LEVELS as string[]).includes(input.budgetLevel)) {
    errors.push("budgetLevel é obrigatório e deve ser um dos valores definidos");
  }

  return { valid: errors.length === 0, errors };
}

export function validateAudiovisualBriefingOutput(
  output: AudiovisualBriefingOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.creativeConcept?.trim())     errors.push("creativeConcept não pode estar vazio");
  if (!Array.isArray(output.script))       errors.push("script deve ser uma lista");
  if (!Array.isArray(output.deliverables)) errors.push("deliverables deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
