/**
 * packages/ai-skills/src/paid-ads/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { PaidAdsInput, PaidAdsOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validatePaidAdsInput(
  input: PaidAdsInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName é obrigatório");
  if (!input.objective?.trim()) errors.push("objective é obrigatório");
  if (!input.promotedEntityType?.trim()) errors.push("promotedEntityType é obrigatório");
  if (!input.promotedEntityName?.trim()) errors.push("promotedEntityName é obrigatório");
  if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
    errors.push("platforms deve conter ao menos 1 plataforma");
  }

  return { valid: errors.length === 0, errors };
}

export function validatePaidAdsOutput(
  output: PaidAdsOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.strategySummary?.trim()) errors.push("strategySummary não pode estar vazio");
  if (!Array.isArray(output.platformSplit) || output.platformSplit.length === 0) {
    errors.push("platformSplit deve conter ao menos 1 item");
  } else {
    const sum = output.platformSplit.reduce((acc, p) => acc + p.percentageShare, 0);
    if (Math.round(sum) !== 100) errors.push(`platformSplit deve somar 100 (soma atual: ${sum})`);
  }
  if (!Array.isArray(output.placementRecommendations)) errors.push("placementRecommendations deve ser uma lista");
  if (!Array.isArray(output.risks)) errors.push("risks deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
