/**
 * packages/ai-skills/src/campaign-strategy/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { CampaignStrategyInput, CampaignStrategyOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateCampaignStrategyInput(
  input: CampaignStrategyInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName é obrigatório");
  if (!input.campaignType?.trim()) errors.push("campaignType é obrigatório");

  return { valid: errors.length === 0, errors };
}

export function validateCampaignStrategyOutput(
  output: CampaignStrategyOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.strategicDirection?.trim()) errors.push("strategicDirection não pode estar vazio");
  if (!output.targetAudience?.trim())     errors.push("targetAudience não pode estar vazio");
  if (!Array.isArray(output.keyMessages)) errors.push("keyMessages deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
