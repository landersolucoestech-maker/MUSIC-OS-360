/**
 * packages/ai-skills/src/performance-report/validator.ts
 *
 * Validação de entrada/saída. Usa o tipo compartilhado SkillValidationResult.
 * Valida também a garantia anti-fabricação: monthlyBreakdown da saída deve
 * corresponder exatamente (mesmos meses, mesmos valores) à série real do
 * input — nunca um valor diferente do que foi fornecido.
 */

import type { PerformanceReportInput, PerformanceReportOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const TRENDS = ["growing", "declining", "stable", "volatile"];

export function validatePerformanceReportInput(
  input: PerformanceReportInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (typeof input.months !== "number" || input.months <= 0) errors.push("months deve ser um número positivo");
  if (!Array.isArray(input.series)) errors.push("series deve ser uma lista");

  return { valid: errors.length === 0, errors };
}

export function validatePerformanceReportOutput(
  output: PerformanceReportOutput,
  input?: PerformanceReportInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.periodSummary?.trim()) errors.push("periodSummary não pode estar vazio");
  if (!TRENDS.includes(output.trend)) errors.push("trend inválido");
  if (!Array.isArray(output.monthlyBreakdown)) errors.push("monthlyBreakdown deve ser uma lista");
  if (!Array.isArray(output.keyObservations)) errors.push("keyObservations deve ser uma lista");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions deve ser uma lista");

  if (input && output.monthlyBreakdown) {
    if (output.monthlyBreakdown.length !== input.series.length) {
      errors.push("monthlyBreakdown deve ter o mesmo número de meses da série real do input — anti-fabricação");
    } else {
      input.series.forEach((real, i) => {
        const reported = output.monthlyBreakdown[i];
        if (!reported || reported.month !== real.month || reported.revenue !== real.revenue || reported.expenses !== real.expenses) {
          errors.push(`monthlyBreakdown[${i}] diverge da série real do input — anti-fabricação`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
