// ─── Feature flags ────────────────────────────────────────────────────────────
// Controlled by the tenant plan + env vars.

export type FeatureFlag =
  | "analytics"
  | "monitoring"
  | "acrcloud"
  | "multiUser"
  | "apiAccess"
  | "advancedReports"
  | "sso";

export const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  analytics: false,
  monitoring: false,
  acrcloud: false,
  multiUser: false,
  apiAccess: false,
  advancedReports: false,
  sso: false,
};

export const PLAN_FLAGS: Record<string, Partial<Record<FeatureFlag, boolean>>> = {
  starter: {},
  professional: {
    analytics: true,
    monitoring: true,
    multiUser: true,
    advancedReports: true,
  },
  enterprise: {
    analytics: true,
    monitoring: true,
    acrcloud: true,
    multiUser: true,
    apiAccess: true,
    advancedReports: true,
    sso: true,
  },
};

export function resolveFlags(plan: string): Record<FeatureFlag, boolean> {
  return {
    ...DEFAULT_FLAGS,
    ...(PLAN_FLAGS[plan] ?? {}),
  };
}
