/**
 * packages/ai-skills/src/automation-audit/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 */

import type { AutomationAuditInput, AutomationAuditOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

const HEALTH_STATUSES = ["healthy", "attention", "critical"];

export function validateAutomationAuditInput(
  input: AutomationAuditInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (typeof input.automationEnabled !== "boolean") errors.push("automationEnabled is required");
  if (typeof input.totalEventsAnalyzed !== "number") errors.push("totalEventsAnalyzed is required");
  if (!Array.isArray(input.eventCounts)) errors.push("eventCounts must be a list");

  return { valid: errors.length === 0, errors };
}

export function validateAutomationAuditOutput(
  output: AutomationAuditOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.auditSummary?.trim()) errors.push("auditSummary must not be empty");
  if (!HEALTH_STATUSES.includes(output.healthStatus)) errors.push("healthStatus is invalid");
  if (!Array.isArray(output.findings)) errors.push("findings must be a list");
  if (!Array.isArray(output.recommendedActions)) errors.push("recommendedActions must be a list");

  return { valid: errors.length === 0, errors };
}
