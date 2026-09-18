/**
 * packages/ai-skills/src/copywriting/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 * Valida também a garantia anti-fabricação: usedFacts deve ser um
 * subconjunto de sourceFacts (input) — nunca um fato novo inventado pelo
 * modelo.
 */

import type { CopywritingInput, CopywritingOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const INTENTS = ["email", "press_release", "landing_copy", "general_draft"];

export function validateCopywritingInput(
  input: CopywritingInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.taskTitle?.trim()) errors.push("taskTitle é obrigatório");
  if (!INTENTS.includes(input.intent)) errors.push("intent inválido");

  return { valid: errors.length === 0, errors };
}

export function validateCopywritingOutput(
  output: CopywritingOutput,
  input?: CopywritingInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.draftTitle?.trim()) errors.push("draftTitle não pode estar vazio");
  if (!output.draftBody?.trim()) errors.push("draftBody não pode estar vazio");
  if (!Array.isArray(output.usedFacts)) errors.push("usedFacts deve ser uma lista");
  if (output.isDraft !== true) errors.push("isDraft deve ser sempre true — anti-fabricação (nunca um texto final)");

  if (input) {
    const allowed = new Set(input.sourceFacts ?? []);
    const invented = output.usedFacts.filter((f) => !allowed.has(f));
    if (invented.length > 0) {
      errors.push(`usedFacts contém fato(s) não presentes em sourceFacts — anti-fabricação: ${invented.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
