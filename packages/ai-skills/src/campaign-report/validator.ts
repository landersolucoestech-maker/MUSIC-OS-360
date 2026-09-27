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

  if (!input.campaignName?.trim()) errors.push("campaignName is required");
  if (!input.campaignType?.trim()) errors.push("campaignType is required");
  if (input.outcomeStatus !== "completed" && input.outcomeStatus !== "cancelled") {
    errors.push("outcomeStatus must be 'completed' or 'cancelled'");
  }

  if (input.externalMetrics !== undefined) {
    if (!Array.isArray(input.externalMetrics)) {
      errors.push("externalMetrics must be an array");
    } else {
      const invalid = input.externalMetrics.some(
        (m) => typeof m.value !== "number" || !Number.isFinite(m.value) || !m.metric?.trim() || !m.source?.trim(),
      );
      if (invalid) errors.push("each externalMetrics entry needs metric, a numeric value and source");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateCampaignReportOutput(
  output: CampaignReportOutput,
  input?: CampaignReportInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.executionSummary?.trim()) errors.push("executionSummary must not be empty");
  if (!Array.isArray(output.metricSummaries)) errors.push("metricSummaries must be a list");

  const hadRealMetrics = Array.isArray(input?.externalMetrics) && input!.externalMetrics!.length > 0;
  if (output.hasMeasuredPerformanceData && !hadRealMetrics) {
    errors.push("hasMeasuredPerformanceData cannot be true without real externalMetrics in the input — anti-fabrication");
  }
  if (!hadRealMetrics && output.metricSummaries.some((m) => m.availability === "actual")) {
    errors.push("no metricSummaries entry may have availability=actual without real externalMetrics in the input — anti-fabrication");
  }

  return { valid: errors.length === 0, errors };
}
