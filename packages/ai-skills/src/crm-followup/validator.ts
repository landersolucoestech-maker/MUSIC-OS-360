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

  if (!input.leadName?.trim()) errors.push("leadName é obrigatório");

  if (!input.leadType || !(LEAD_TYPES as string[]).includes(input.leadType)) {
    errors.push("leadType é obrigatório e deve ser um dos valores definidos");
  }

  if (!input.currentStage || !(STAGES as string[]).includes(input.currentStage)) {
    errors.push("currentStage é obrigatório e deve ser um dos valores definidos");
  }

  if (!input.objective?.trim()) errors.push("objective é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validateCrmFollowupOutput(output: CrmFollowupOutput): SkillValidationResult {
  const errors: string[] = [];

  if (!output.nextAction?.trim())      errors.push("nextAction não pode estar vazio");
  if (!output.followUpMessage?.trim()) errors.push("followUpMessage não pode estar vazio");

  if (typeof output.conversionProbability !== "number") {
    errors.push("conversionProbability deve ser numérico");
  } else if (output.conversionProbability < 0 || output.conversionProbability > 1) {
    errors.push("conversionProbability deve estar entre 0 e 1");
  }

  return { valid: errors.length === 0, errors };
}
