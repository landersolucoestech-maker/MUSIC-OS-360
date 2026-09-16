/**
 * packages/ai-skills/src/launch-strategy/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { LaunchStrategyInput, LaunchStrategyOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateLaunchStrategyInput(
  input: LaunchStrategyInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.releaseTitle?.trim()) errors.push("releaseTitle é obrigatório");
  if (!input.releaseType?.trim()) errors.push("releaseType é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validateLaunchStrategyOutput(
  output: LaunchStrategyOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.strategicNarrative?.trim()) errors.push("strategicNarrative não pode estar vazio");
  if (!output.targetAudience?.trim()) errors.push("targetAudience não pode estar vazio");
  if (!output.competitivePositioning?.trim()) errors.push("competitivePositioning não pode estar vazio");
  if (!Array.isArray(output.keyMessages)) errors.push("keyMessages deve ser uma lista");
  if (!Array.isArray(output.successSignals)) errors.push("successSignals deve ser uma lista");
  if (!Array.isArray(output.riskFactors)) errors.push("riskFactors deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
