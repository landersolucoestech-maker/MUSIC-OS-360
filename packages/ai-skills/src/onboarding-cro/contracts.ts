/**
 * packages/ai-skills/src/onboarding-cro/contracts.ts
 *
 * Contracts of the onboarding-cro skill (version 1.0.0).
 * Analysis of a tenant's REAL onboarding funnel — the 7 steps already defined
 * in apps/web/src/app/providers/TenantContext.tsx (OnboardingStep:
 * company_profile, invite_team, first_artist, first_catalog_item,
 * first_contract, connect_integration, complete), whose completion is TODAY
 * computed by NO backend (repo-wide grep: zero references to those 7 names
 * outside the frontend) — only the company_profile step is actually written
 * (PATCH /auth/onboarding).
 *
 * This skill IMPLEMENTS the real computation of each step from existing real
 * counts (artists/works+phonograms/contracts/org_members/oauth_connections) —
 * it never fabricates a completed step or a cross-tenant aggregate conversion
 * rate (the product has no funnel/cohort engine; only this single tenant's REAL
 * progress is reported).
 *
 * ANTI-FABRICATION: each `completed` in stepsStatus is a boolean DERIVED
 * deterministically from a real count in the automation layer — the model never
 * decides whether a step is complete; it only receives the computed result and
 * narrates/recommends.
 *
 * Execution: ON_DEMAND, triggered by the user (e.g. the tenant admin panel) or
 * possibly auto-shown while onboarding is incomplete — the exact invocation
 * trigger is a UI decision, not this skill's.
 */

import type { SkillLanguage, SkillPriority } from "../shared/primitives";

export type OnboardingCroLanguage = SkillLanguage;

export type OnboardingStepName =
  | "company_profile"
  | "invite_team"
  | "first_artist"
  | "first_catalog_item"
  | "first_contract"
  | "connect_integration";

export interface OnboardingStepStatus {
  step: OnboardingStepName;
  completed: boolean;
  evidenceCount: number;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface OnboardingCroInput {
  tenantName: string;
  steps: OnboardingStepStatus[];
  context?: string;
  language?: OnboardingCroLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface OnboardingCroAction {
  action: string;
  priority: SkillPriority;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface OnboardingCroOutput {
  progressSummary: string;
  completedStepsCount: number;
  totalStepsCount: number;
  nextRecommendedStep: string;
  recommendedActions: OnboardingCroAction[];
}
