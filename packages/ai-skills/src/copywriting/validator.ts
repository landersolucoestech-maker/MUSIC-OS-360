/**
 * packages/ai-skills/src/copywriting/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 * Also validates the anti-fabrication guarantee: usedFacts must be a subset of
 * sourceFacts (input) — never a new fact invented by the model.
 */

import type { CopywritingInput, CopywritingOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const INTENTS = ["email", "press_release", "landing_copy", "general_draft"];

export function validateCopywritingInput(
  input: CopywritingInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.taskTitle?.trim()) errors.push("taskTitle is required");
  if (!INTENTS.includes(input.intent)) errors.push("intent is invalid");

  return { valid: errors.length === 0, errors };
}

export function validateCopywritingOutput(
  output: CopywritingOutput,
  input?: CopywritingInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.draftTitle?.trim()) errors.push("draftTitle must not be empty");
  if (!output.draftBody?.trim()) errors.push("draftBody must not be empty");
  if (!Array.isArray(output.usedFacts)) errors.push("usedFacts must be a list");
  if (output.isDraft !== true) errors.push("isDraft must always be true — anti-fabrication (never a final text)");

  if (input) {
    const allowed = new Set(input.sourceFacts ?? []);
    const invented = output.usedFacts.filter((f) => !allowed.has(f));
    if (invented.length > 0) {
      errors.push(`usedFacts contains fact(s) not present in sourceFacts — anti-fabrication: ${invented.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
