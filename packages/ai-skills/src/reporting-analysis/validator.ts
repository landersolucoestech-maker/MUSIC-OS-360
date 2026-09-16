/**
 * packages/ai-skills/src/reporting-analysis/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
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
    if (typeof value !== "number" || Number.isNaN(value)) errors.push(`${name} é obrigatório e deve ser numérico`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateReportingAnalysisOutput(
  output: ReportingAnalysisOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.analysisSummary?.trim()) errors.push("analysisSummary não pode estar vazio");
  if (!HEALTH_STATUSES.includes(output.healthStatus)) errors.push("healthStatus inválido");
  if (!Array.isArray(output.highlights)) errors.push("highlights deve ser uma lista");
  if (!Array.isArray(output.concerns)) errors.push("concerns deve ser uma lista");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
