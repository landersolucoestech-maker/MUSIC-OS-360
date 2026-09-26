/**
 * modules/admin/data/admin-source.ts
 *
 * Exposure gate of the administrative data.
 * In production (IS_PROD), mocks are NOT exposed — every export returns
 * empty arrays / zeroed KPIs. The admin pages must render the empty state
 * "Admin analytics indisponível — endpoint real ainda não implementado".
 *
 *
 * When real `/admin/*` endpoints exist, replace this layer with
 * hooks that consume the real API.
 */
import type {
  AdminKPIs, RevenueDataPoint, AdminPlan, AdminTenant,
  AdminSubscription, AdminSecurityEvent,
  AdminNotification, AdminIntegration, AdminSystemMetric,
  PlatformIntegrationProvider,
} from "../types";

/** Fictitious data no longer exists in any mode. */
export const ADMIN_DATA_IS_MOCK = false as const;

const EMPTY_KPIS: AdminKPIs = {
  mrr: 0, arr: 0, total_tenants: 0, active_tenants: 0, trial_tenants: 0, churned_tenants: 0,
  total_users: 0, active_users_30d: 0, churn_rate_pct: 0, trial_conversion_pct: 0,
  avg_ltv: 0, avg_cac: 0, open_tickets: 0, system_uptime_pct: 0,
  mrr_growth_pct: 0, new_tenants_30d: 0, dau: 0, mau: 0, sessions_today: 0, nps_score: 0,
};

export const ADMIN_KPIS: AdminKPIs             = EMPTY_KPIS;
export const ADMIN_REVENUE: RevenueDataPoint[] = [];
export const ADMIN_PLANS: AdminPlan[]          = [];
export const ADMIN_TENANTS: AdminTenant[]      = [];
export const ADMIN_SUBSCRIPTIONS: AdminSubscription[] = [];
// ADMIN_USERS removed — Users uses the real backend via useAdminUsers() (GET /admin/users).
export const ADMIN_SECURITY_EVENTS: AdminSecurityEvent[] = [];
export const ADMIN_NOTIFICATIONS: AdminNotification[] = [];
export const ADMIN_INTEGRATIONS: AdminIntegration[] = [];
export const ADMIN_PLATFORM_PROVIDERS: PlatformIntegrationProvider[] = [];
export const ADMIN_SYSTEM_METRICS: AdminSystemMetric[] = [];
