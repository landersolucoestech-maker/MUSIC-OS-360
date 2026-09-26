/**
 * modules/admin/services/admin-integrations.service.ts
 *
 * Admin portal → Settings → Integrations.
 * PERSISTED governance — replaces the old local state seeded by a
 * hardcoded array (ADMIN_PLATFORM_PROVIDERS, which was literally empty, leaving
 * the tab with nothing to show).
 */

import { api } from "@/shared/lib/api-client";

export type AudienceMode = "none" | "all" | "plans" | "tenants";
/** Commercial rollout — separate from technical state, entitlement and connection. */
export type PublicationState =
  | "hidden" | "coming_soon" | "beta" | "available" | "temporarily_unavailable";
/** Operational state of the adapter, governable by the admin. */
export type TechnicalState =
  | "planned" | "in_development" | "configuring" | "awaiting_provider"
  | "homologating" | "ready" | "degraded" | "disabled" | "retired";
/** Capability derived from the CODE — vetoes an optimistic technical_state. */
export type TechnicalCapability = "implemented" | "not_implemented";
export type IntegrationClassification =
  | "commercial" | "internal_platform" | "platform_billing";

export interface IntegrationAudience {
  mode: AudienceMode;
  plans: string[];
  tenantIds: string[];
}

export interface AdminIntegration {
  id: string;
  providerKey: string;
  name: string;
  categorySlug: string | null;
  categoryName: string | null;
  connectionKind: "oauth" | "tenant_credentials" | "platform_credentials";
  requiredEnv: string[];
  publicationState: PublicationState;
  technicalState: TechnicalState;
  classification: IntegrationClassification;
  /** Plans that include this slug — read-only; editing lives in the plan editor. */
  includedInPlans: string[];
  viewAudience: IntegrationAudience;
  useAudience: IntegrationAudience;
  isCore: boolean;
  notes: string | null;
  /** Read-only — derived from the code, not editable by an admin. */
  technicalCapability: TechnicalCapability;
  capabilityEvidence: string | null;
  /** Published without an adapter: a contradiction the admin must see. */
  publishedWithoutCapability: boolean;
}

export interface IntegrationCategory {
  id: string;
  slug: string;
  name: string;
  display_order: number;
  active: boolean;
}

export interface UpdateIntegrationGovernanceInput {
  categoryId?: string | null;
  publicationState?: PublicationState;
  viewAudience?: IntegrationAudience;
  useAudience?: IntegrationAudience;
  notes?: string | null;
}

export const adminIntegrationsService = {
  list: () => api.get<AdminIntegration[]>("/admin/integrations"),
  listCategories: () => api.get<IntegrationCategory[]>("/admin/integrations/categories"),
  update: (id: string, patch: UpdateIntegrationGovernanceInput) =>
    api.patch<AdminIntegration>(`/admin/integrations/${id}`, patch),
};

/**
 * Per-plan integration entitlements (billing_plans.integrations).
 * A dynamic list of commercial slugs — the plan editor knows no provider
 * at all in code.
 */
export const adminPlanIntegrationsService = {
  get: (planSlug: string) => api.get<string[]>(`/admin/integrations/plans/${planSlug}`),
  set: (planSlug: string, integrations: string[]) =>
    api.put<{ planSlug: string; integrations: string[]; rejected: string[] }>(
      `/admin/integrations/plans/${planSlug}`,
      { integrations },
    ),
};
