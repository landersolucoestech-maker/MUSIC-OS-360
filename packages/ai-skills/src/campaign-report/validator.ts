/**
 * packages/ai-skills/src/campaign-report/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 * Besides the required fields, it validates the critical anti-fabrication rule:
 * hasMeasuredPerformanceData can only be true when the input really contained
 * externalMetrics — the parser can never "promote" heuristic data to measured,
 * and this validation is the safety net confirming the model's output
 * respected that rule.
 */

import type { CampaignReportInput, CampaignReportOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateCampaignReportInput(
  input: CampaignReportInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName é obrigatório");
  if (!input.campaignType?.trim()) errors.push("campaignType é obrigatório");
  if (input.outcomeStatus !== "completed" && input.outcomeStatus !== "cancelled") {
    errors.push("outcomeStatus deve ser 'completed' ou 'cancelled'");
  }

  if (input.externalMetrics !== undefined) {
    if (!Array.isArray(input.externalMetrics)) {
      errors.push("externalMetrics deve ser um array");
    } else {
      const invalid = input.externalMetrics.some(
        (m) => typeof m.value !== "number" || !Number.isFinite(m.value) || !m.metric?.trim() || !m.source?.trim(),
      );
      if (invalid) errors.push("cada externalMetrics precisa de metric, value numérico e source");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateCampaignReportOutput(
  output: CampaignReportOutput,
  input?: CampaignReportInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.executionSummary?.trim()) errors.push("executionSummary não pode estar vazio");
  if (!Array.isArray(output.metricSummaries)) errors.push("metricSummaries deve ser uma lista");

  const hadRealMetrics = Array.isArray(input?.externalMetrics) && input!.externalMetrics!.length > 0;
  if (output.hasMeasuredPerformanceData && !hadRealMetrics) {
    errors.push("hasMeasuredPerformanceData não pode ser true sem externalMetrics reais no input — anti-fabricação");
  }
  if (!hadRealMetrics && output.metricSummaries.some((m) => m.availability === "actual")) {
    errors.push("nenhum metricSummaries pode ter availability=actual sem externalMetrics reais no input — anti-fabricação");
  }

  return { valid: errors.length === 0, errors };
}
