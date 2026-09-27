/**
 * packages/ai-skills/src/seo-audit/validator.ts
 *
 * Input/output validation. Uses the shared SkillValidationResult type.
 * Also validates the anti-fabrication guarantee: no check may have
 * source="external_measurement" (this skill runs no external measurement).
 */

import type { SeoAuditInput, SeoAuditOutput } from "./contracts";
import type { SkillValidationResult } from "../shared/primitives";

export function validateSeoAuditInput(
  input: SeoAuditInput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!input.campaignName?.trim()) errors.push("campaignName is required");
  if (!input.promotedEntityType?.trim()) errors.push("promotedEntityType is required");
  if (!input.promotedEntityName?.trim()) errors.push("promotedEntityName is required");
  if (typeof input.hasUtm !== "boolean") errors.push("hasUtm is required");

  return { valid: errors.length === 0, errors };
}

export function validateSeoAuditOutput(
  output: SeoAuditOutput,
): SkillValidationResult {
  const errors: string[] = [];

  if (!output.auditSummary?.trim()) errors.push("auditSummary must not be empty");
  if (!Array.isArray(output.checks)) errors.push("checks must be a list");
  else if (output.checks.some((c) => c.source === "external_measurement")) {
    errors.push("no check may have source=external_measurement — anti-fabrication (this skill measures nothing external)");
  }
  if (!Array.isArray(output.unavailableMetrics)) errors.push("unavailableMetrics must be a list");

  return { valid: errors.length === 0, errors };
}
