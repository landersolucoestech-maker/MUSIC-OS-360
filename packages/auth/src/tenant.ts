// ─── Tenant Scope Utilities ───────────────────────────────────────────────────

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  plan: "starter" | "professional" | "enterprise";
}

export interface TenantScopedQuery {
  tenant_id: string;
}

/**
 * Ensures a query includes the correct tenant_id.
 * Prevents cross-tenant data leakage.
 */
export function scopeToTenant<T extends object>(
  data: T,
  tenantId: string,
): T & TenantScopedQuery {
  return { ...data, tenant_id: tenantId };
}

/**
 * Validates that a resource belongs to the correct tenant.
 * Throws if the tenant_id does not match (IDOR prevention).
 */
export function assertTenantOwnership(
  resourceTenantId: string,
  requestingTenantId: string,
  resourceName = "recurso",
): void {
  if (resourceTenantId !== requestingTenantId) {
    throw new Error(
      `Access denied: ${resourceName} does not belong to tenant ${requestingTenantId}`,
    );
  }
}

/**
 * Extracts the tenant_id from a standard Music OS 360 JWT payload.
 */
export function extractTenantFromPayload(
  payload: Record<string, unknown>,
): string | null {
  return (
    (payload["tenant_id"] as string) ??
    (payload["tenantId"] as string) ??
    null
  );
}

/**
 * Feature flags per tenant plan.
 */
export const PLAN_FEATURES: Record<
  TenantContext["plan"],
  Record<string, boolean>
> = {
  starter: {
    analytics: false,
    monitoring: false,
    acrcloud: false,
    multiUser: false,
    apiAccess: false,
  },
  professional: {
    analytics: true,
    monitoring: true,
    acrcloud: false,
    multiUser: true,
    apiAccess: false,
  },
  enterprise: {
    analytics: true,
    monitoring: true,
    acrcloud: true,
    multiUser: true,
    apiAccess: true,
  },
};

export function hasFeature(
  plan: TenantContext["plan"],
  feature: string,
): boolean {
  return PLAN_FEATURES[plan]?.[feature] ?? false;
}
