/**
 * skills/marketing-calendar-builder/validators/marketing-calendar-builder.validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type {
  MarketingCalendarBuilderInput,
  MarketingCalendarBuilderOutput,
  MarketingFrequency,
} from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const FREQUENCIES: MarketingFrequency[] = ["low", "medium", "high", "intensive"];

function parseDate(value: string): number | null {
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

export function validateMarketingCalendarBuilderInput(
  input: MarketingCalendarBuilderInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.artistName?.trim())   errors.push("artistName é obrigatório");
  if (!input.campaignGoal?.trim()) errors.push("campaignGoal é obrigatório");
  if (!input.startDate?.trim())    errors.push("startDate é obrigatório");
  if (!input.endDate?.trim())      errors.push("endDate é obrigatório");

  if (input.startDate?.trim() && input.endDate?.trim()) {
    const start = parseDate(input.startDate);
    const end = parseDate(input.endDate);
    if (start !== null && end !== null && start > end) {
      errors.push("startDate deve ser anterior ou igual a endDate");
    }
  }

  if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
    errors.push("platforms deve ter pelo menos 1 item");
  }

  if (!input.frequency || !(FREQUENCIES as string[]).includes(input.frequency)) {
    errors.push("frequency é obrigatório e deve ser um dos valores definidos");
  }

  return { valid: errors.length === 0, errors };
}

export function validateMarketingCalendarBuilderOutput(
  output: MarketingCalendarBuilderOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(output.calendar))       errors.push("calendar deve ser uma lista");
  if (!Array.isArray(output.campaignPhases)) errors.push("campaignPhases deve ser uma lista");

  return { valid: errors.length === 0, errors };
}
