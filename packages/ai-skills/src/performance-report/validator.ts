/**
 * packages/ai-skills/src/performance-report/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 * Also validates the anti-fabrication guarantee: the output monthlyBreakdown
 * must match the input's real series exactly (same months, same values) —
 * never a value different from what was provided.
 */

import type { PerformanceReportInput, PerformanceReportOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const TRENDS = ["growing", "declining", "stable", "volatile"];

export function validatePerformanceReportInput(
  input: PerformanceReportInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (typeof input.months !== "number" || input.months <= 0) errors.push("months must be a positive number");
  if (!Array.isArray(input.series)) errors.push("series must be a list");

  return { valid: errors.length === 0, errors };
}

export function validatePerformanceReportOutput(
  output: PerformanceReportOutput,
  input?: PerformanceReportInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.periodSummary?.trim()) errors.push("periodSummary must not be empty");
  if (!TRENDS.includes(output.trend)) errors.push("trend is invalid");
  if (!Array.isArray(output.monthlyBreakdown)) errors.push("monthlyBreakdown must be a list");
  if (!Array.isArray(output.keyObservations)) errors.push("keyObservations must be a list");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions must be a list");

  if (input && output.monthlyBreakdown) {
    if (output.monthlyBreakdown.length !== input.series.length) {
      errors.push("monthlyBreakdown must have the same number of months as the real input series — anti-fabrication");
    } else {
      input.series.forEach((real, i) => {
        const reported = output.monthlyBreakdown[i];
        if (!reported || reported.month !== real.month || reported.revenue !== real.revenue || reported.expenses !== real.expenses) {
          errors.push(`monthlyBreakdown[${i}] diverges from the real input series — anti-fabrication`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
