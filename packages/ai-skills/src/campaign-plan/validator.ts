/**
 * packages/ai-skills/src/campaign-plan/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { CampaignPlanInput, CampaignPlanOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateCampaignPlanInput(
  input: CampaignPlanInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName é obrigatório");
  if (!input.campaignType?.trim()) errors.push("campaignType é obrigatório");

  if (input.budget !== undefined) {
    if (typeof input.budget !== "number" || Number.isNaN(input.budget) || !Number.isFinite(input.budget) || input.budget < 0) {
      errors.push("budget, se informado, deve ser um número válido >= 0");
    }
  }

  if (input.platforms !== undefined && !Array.isArray(input.platforms)) {
    errors.push("platforms deve ser um array");
  }

  return { valid: errors.length === 0, errors };
}

export function validateCampaignPlanOutput(
  output: CampaignPlanOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.planSummary?.trim()) errors.push("planSummary não pode estar vazio");
  if (!Array.isArray(output.channels)) errors.push("channels deve ser uma lista");
  if (!Array.isArray(output.suggestedTasks)) errors.push("suggestedTasks deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
