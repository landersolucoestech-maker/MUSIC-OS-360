/**
 * packages/ai-skills/src/onboarding-cro/contracts.ts
 *
 * Contratos da skill onboarding-cro (version 1.0.0).
 * Análise do funil de onboarding REAL de um tenant — os 7 passos já
 * definidos em apps/web/src/app/providers/TenantContext.tsx
 * (OnboardingStep: company_profile, invite_team, first_artist,
 * first_catalog_item, first_contract, connect_integration, complete), cuja
 * conclusão HOJE NÃO é computada por nenhum backend (grep repo-wide: zero
 * referência a esses 7 nomes fora do frontend) — apenas o passo
 * company_profile é de fato gravado (PATCH /auth/onboarding).
 *
 * Esta skill IMPLEMENTA o cálculo real de cada passo a partir de contagens
 * reais já existentes (artists/works+phonograms/contracts/org_members/
 * oauth_connections) — nunca fabrica um passo concluído nem uma taxa de
 * conversão agregada entre tenants (não existe motor de funil/cohort no
 * produto; apenas o progresso REAL deste único tenant é reportado).
 *
 * ANTI-FABRICAÇÃO: cada `completed` em stepsStatus é um booleano DERIVADO
 * deterministicamente de uma contagem real no automation layer — o modelo
 * nunca decide se um passo está concluído, apenas recebe o resultado já
 * calculado e narra/recomenda.
 *
 * Execução: ON_DEMAND, disparada pelo usuário (ex.: painel de admin do
 * tenant) ou possivelmente auto-exibida enquanto o onboarding não está
 * completo — o trigger exato de invocação é uma decisão de UI, não desta
 * skill.
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

// ─── Blocos de saída ──────────────────────────────────────────────────────────

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
