/**
 * packages/ai-skills/src/project-planning/validator.ts
 */

import type {
  ProjectPlanningInput,
  ProjectPlanningOutput,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export type ValidationResult = SkillValidationResult;

export function validateProjectPlanningInput(input: ProjectPlanningInput): SkillValidationResult {
  const errors: string[] = [];

  if (!input.projectName?.trim()) errors.push("projectName is required");
  if (!input.projectType?.trim()) errors.push("projectType is required");

  if (!Array.isArray(input.departments) || input.departments.length === 0) {
    errors.push("departments must have at least 1 item");
  }

  if (!Array.isArray(input.goals) || input.goals.length === 0) {
    errors.push("goals must have at least 1 item");
  }

  return { valid: errors.length === 0, errors };
}

export function validateProjectPlanningOutput(output: ProjectPlanningOutput): SkillValidationResult {
  const errors: string[] = [];

  if (!output.summary?.trim())        errors.push("summary must not be empty");
  if (!Array.isArray(output.phases))  errors.push("phases must be a list");
  if (!Array.isArray(output.tasks))   errors.push("tasks must be a list");

  return { valid: errors.length === 0, errors };
}
