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

  if (!input.artistName?.trim())   errors.push("artistName is required");
  if (!input.campaignGoal?.trim()) errors.push("campaignGoal is required");
  if (!input.startDate?.trim())    errors.push("startDate is required");
  if (!input.endDate?.trim())      errors.push("endDate is required");

  if (input.startDate?.trim() && input.endDate?.trim()) {
    const start = parseDate(input.startDate);
    const end = parseDate(input.endDate);
    if (start !== null && end !== null && start > end) {
      errors.push("startDate must be on or before endDate");
    }
  }

  if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
    errors.push("platforms must have at least 1 item");
  }

  if (!input.frequency || !(FREQUENCIES as string[]).includes(input.frequency)) {
    errors.push("frequency is required and must be one of the defined values");
  }

  return { valid: errors.length === 0, errors };
}

export function validateMarketingCalendarBuilderOutput(
  output: MarketingCalendarBuilderOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(output.calendar))       errors.push("calendar must be a list");
  if (!Array.isArray(output.campaignPhases)) errors.push("campaignPhases must be a list");

  return { valid: errors.length === 0, errors };
}
