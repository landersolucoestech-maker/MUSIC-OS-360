/**
 * packages/ai-skills/src/audience-health/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 */

import type { AudienceHealthInput, AudienceHealthOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const HEALTH_STATUSES = ["healthy", "attention", "critical", "insufficient_data"];

export function validateAudienceHealthInput(
  input: AudienceHealthInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.artistName?.trim()) errors.push("artistName é obrigatório");
  if (input.careerStageStatus !== "OK" && input.careerStageStatus !== "INSUFFICIENT_DATA") {
    errors.push("careerStageStatus deve ser 'OK' ou 'INSUFFICIENT_DATA'");
  }
  if (typeof input.careerStageConfidence !== "number") errors.push("careerStageConfidence é obrigatório");
  if (!["READY", "STALE", "REFRESHING", "INTEGRATION_UNAVAILABLE", "ERROR"].includes(input.marketBenchmarkReadStatus)) {
    errors.push("marketBenchmarkReadStatus inválido");
  }

  return { valid: errors.length === 0, errors };
}

export function validateAudienceHealthOutput(
  output: AudienceHealthOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.healthSummary?.trim()) errors.push("healthSummary não pode estar vazio");
  if (!HEALTH_STATUSES.includes(output.healthStatus)) errors.push("healthStatus inválido");
  if (!Array.isArray(output.strengths)) errors.push("strengths deve ser uma lista");
  if (!Array.isArray(output.concerns)) errors.push("concerns deve ser uma lista");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions deve ser uma lista");
  if (!Array.isArray(output.dataGaps)) errors.push("dataGaps deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
