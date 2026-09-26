/**
 * packages/ai-skills/src/shared/primitives.ts
 *
 * Shared AI Skills primitives — single source for web and api.
 * Structurally identical to those defined in apps/web (domain/ai.types.ts),
 * enabling reuse without coupling to a specific app.
 */

export type SkillLanguage = "pt-BR" | "en-US";

export type SkillSeverity = "low" | "medium" | "high" | "critical";

export type SkillPriority = "low" | "medium" | "high" | "critical";

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
}
