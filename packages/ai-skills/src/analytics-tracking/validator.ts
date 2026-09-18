/**
 * packages/ai-skills/src/analytics-tracking/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { AnalyticsTrackingInput, AnalyticsTrackingOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateAnalyticsTrackingInput(
  input: AnalyticsTrackingInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.providerName?.trim()) errors.push("providerName é obrigatório");
  if (input.providerState !== "configured" && input.providerState !== "configuration_required") {
    errors.push("providerState deve ser 'configured' ou 'configuration_required'");
  }
  if (typeof input.totalCanonicalEvents !== "number") errors.push("totalCanonicalEvents é obrigatório");
  if (!Array.isArray(input.coverage)) errors.push("coverage deve ser uma lista");

  return { valid: errors.length === 0, errors };
}

export function validateAnalyticsTrackingOutput(
  output: AnalyticsTrackingOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.coverageSummary?.trim()) errors.push("coverageSummary não pode estar vazio");
  if (typeof output.coveragePercentage !== "number") errors.push("coveragePercentage é obrigatório");
  if (!Array.isArray(output.gaps)) errors.push("gaps deve ser uma lista");
  if (!Array.isArray(output.recommendations)) errors.push("recommendations deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
