/**
 * packages/ai-skills/src/support-triage/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type {
  SupportTriageInput,
  SupportTriageOutput,
  SupportModule,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export type ValidationResult = SkillValidationResult;

const MODULES: SupportModule[] = [
  "artists", "releases", "contracts", "financial", "catalog", "marketing",
  "audiovisual", "agenda", "integrations", "ai", "settings", "support", "other",
];

export function validateSupportTriageInput(input: SupportTriageInput): SkillValidationResult {
  const errors: string[] = [];

  if (!input.subject?.trim()) errors.push("subject is required");
  if (!input.message?.trim()) errors.push("message is required");

  if (input.affectedModule !== undefined && !(MODULES as string[]).includes(input.affectedModule)) {
    errors.push("affectedModule, if provided, must be one of the defined values");
  }

  return { valid: errors.length === 0, errors };
}

export function validateSupportTriageOutput(output: SupportTriageOutput): SkillValidationResult {
  const errors: string[] = [];

  if (!output.category?.trim())          errors.push("category must not be empty");
  if (!output.suggestedResponse?.trim()) errors.push("suggestedResponse must not be empty");
  if (typeof output.escalationNeeded !== "boolean") errors.push("escalationNeeded must be a boolean");

  return { valid: errors.length === 0, errors };
}
