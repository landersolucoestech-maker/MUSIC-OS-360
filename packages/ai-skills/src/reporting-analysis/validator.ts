/**
 * packages/ai-skills/src/reporting-analysis/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { ReportingAnalysisInput, ReportingAnalysisOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const HEALTH_STATUSES = ["healthy", "attention", "critical"];

export function validateReportingAnalysisInput(
  input: ReportingAnalysisInput,
): SkillValidationResult {
  const errors: string[] = [];

  const requiredNumbers: Array<[string, unknown]> = [
    ["artists", input.artists],
    ["activeContractsCount", input.activeContractsCount],
    ["leads", input.leads],
    ["campaigns", input.campaigns],
    ["revenueCurrentMonth", input.revenueCurrentMonth],
    ["expensesCurrentMonth", input.expensesCurrentMonth],
    ["netResultCurrentMonth", input.netResultCurrentMonth],
  ];
  for (const [name, value] of requiredNumbers) {
    if (typeof value !== "number" || Number.isNaN(value)) errors.push(`${name} is required and must be numeric`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateReportingAnalysisOutput(
  output: ReportingAnalysisOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.analysisSummary?.trim()) errors.push("analysisSummary must not be empty");
  if (!HEALTH_STATUSES.includes(output.healthStatus)) errors.push("healthStatus is invalid");
  if (!Array.isArray(output.highlights)) errors.push("highlights must be a list");
  if (!Array.isArray(output.concerns)) errors.push("concerns must be a list");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions must be a list");

  return { valid: errors.length === 0, errors };
}
