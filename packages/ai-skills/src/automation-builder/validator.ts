/**
 * packages/ai-skills/src/automation-builder/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { AutomationBuilderInput, AutomationBuilderOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateAutomationBuilderInput(
  input: AutomationBuilderInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(input.currentMenuOptionLabels)) errors.push("currentMenuOptionLabels deve ser uma lista");
  if (!Array.isArray(input.currentEscalationLevels)) errors.push("currentEscalationLevels deve ser uma lista");
  if (typeof input.invalidOptionCount !== "number") errors.push("invalidOptionCount é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validateAutomationBuilderOutput(
  output: AutomationBuilderOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.suggestionsSummary?.trim()) errors.push("suggestionsSummary não pode estar vazio");
  if (!Array.isArray(output.suggestedMenuChanges)) errors.push("suggestedMenuChanges deve ser uma lista");
  if (!Array.isArray(output.suggestedEscalationChanges)) errors.push("suggestedEscalationChanges deve ser uma lista");
  if (!Array.isArray(output.risks)) errors.push("risks deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
