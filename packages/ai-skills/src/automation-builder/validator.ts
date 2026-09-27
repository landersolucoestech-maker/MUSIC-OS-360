/**
 * packages/ai-skills/src/automation-builder/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { AutomationBuilderInput, AutomationBuilderOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateAutomationBuilderInput(
  input: AutomationBuilderInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(input.currentMenuOptionLabels)) errors.push("currentMenuOptionLabels must be a list");
  if (!Array.isArray(input.currentEscalationLevels)) errors.push("currentEscalationLevels must be a list");
  if (typeof input.invalidOptionCount !== "number") errors.push("invalidOptionCount is required");

  return { valid: errors.length === 0, errors };
}

export function validateAutomationBuilderOutput(
  output: AutomationBuilderOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.suggestionsSummary?.trim()) errors.push("suggestionsSummary must not be empty");
  if (!Array.isArray(output.suggestedMenuChanges)) errors.push("suggestedMenuChanges must be a list");
  if (!Array.isArray(output.suggestedEscalationChanges)) errors.push("suggestedEscalationChanges must be a list");
  if (!Array.isArray(output.risks)) errors.push("risks must be a list");

  return { valid: errors.length === 0, errors };
}
