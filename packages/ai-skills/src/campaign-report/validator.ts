/**
 * packages/ai-skills/src/campaign-report/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 * Além dos campos obrigatórios, valida a regra crítica anti-fabricação:
 * hasMeasuredPerformanceData só pode ser true quando o input realmente
 * continha externalMetrics — o parser nunca pode "promover" dados
 * heurísticos a medidos, e esta validação é a rede de segurança que
 * confirma que a saída do modelo respeitou essa regra.
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
