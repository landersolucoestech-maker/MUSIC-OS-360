/**
 * skills/crm-followup/validators/crm-followup.validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type {
  CrmFollowupInput,
  CrmFollowupOutput,
  CrmLeadType,
  CrmStage,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const LEAD_TYPES: CrmLeadType[] = [
  "artist", "label", "publisher", "producer", "brand", "partner", "supplier", "client", "other",
];

const STAGES: CrmStage[] = [
  "new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "inactive",
];

export function validateCrmFollowupInput(input: CrmFollowupInput): SkillValidationResult {
  const errors: string[] = [];

  if (!input.leadName?.trim()) errors.push("leadName is required");

  if (!input.leadType || !(LEAD_TYPES as string[]).includes(input.leadType)) {
    errors.push("leadType is required and must be one of the defined values");
  }

  if (!input.currentStage || !(STAGES as string[]).includes(input.currentStage)) {
    errors.push("currentStage is required and must be one of the defined values");
  }

  if (!input.objective?.trim()) errors.push("objective is required");

  return { valid: errors.length === 0, errors };
}

export function validateCrmFollowupOutput(output: CrmFollowupOutput): SkillValidationResult {
  const errors: string[] = [];

  if (!output.nextAction?.trim())      errors.push("nextAction must not be empty");
  if (!output.followUpMessage?.trim()) errors.push("followUpMessage must not be empty");

  if (typeof output.conversionProbability !== "number") {
    errors.push("conversionProbability must be numeric");
  } else if (output.conversionProbability < 0 || output.conversionProbability > 1) {
    errors.push("conversionProbability must be between 0 and 1");
  }

  return { valid: errors.length === 0, errors };
}
