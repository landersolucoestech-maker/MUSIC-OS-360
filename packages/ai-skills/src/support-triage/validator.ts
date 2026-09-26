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

  if (!input.subject?.trim()) errors.push("subject é obrigatório");
  if (!input.message?.trim()) errors.push("message é obrigatório");

  if (input.affectedModule !== undefined && !(MODULES as string[]).includes(input.affectedModule)) {
    errors.push("affectedModule, se informado, deve ser um dos valores definidos");
  }

  return { valid: errors.length === 0, errors };
}

export function validateSupportTriageOutput(output: SupportTriageOutput): SkillValidationResult {
  const errors: string[] = [];

  if (!output.category?.trim())          errors.push("category não pode estar vazio");
  if (!output.suggestedResponse?.trim()) errors.push("suggestedResponse não pode estar vazio");
  if (typeof output.escalationNeeded !== "boolean") errors.push("escalationNeeded deve ser booleano");

  return { valid: errors.length === 0, errors };
}
