export type TenantStatus = "active" | "trial" | "suspended" | "cancelled" | "past_due" | "pending";
export type PlanTier = "starter" | "growth" | "pro" | "professional" | "enterprise";
export type AdminUserStatus = "active" | "blocked";
export type SubscriptionStatus = "active" | "trial" | "past_due" | "payment_grace" | "read_only" | "suspended" | "cancelled" | "unpaid";
export type BillingCycle = "monthly" | "annual";
export type ServiceHealth = "healthy" | "degraded" | "down";
export type SecurityEventType = "brute_force" | "suspicious_ip" | "failed_login" | "account_locked" | string;
export type SecuritySeverity = "low" | "medium" | "high" | "critical";
export type NotificationSeverity = "info" | "warning" | "error" | "success";
export type IntegrationStatus = "active" | "error" | "pending" | "disabled" | "inactive";
export type IntegrationCategory = "payment" | "music" | "communication" | "analytics" | "storage" | "accounting" | string;
export type SupportTicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketStatus = SupportTicketStatus;
export type SupportTicketPriority = "low" | "medium" | "high" | "critical";
export type TicketPriority = SupportTicketPriority;
export type AuditAction = "create" | "update" | "delete" | "suspend" | "activate" | "plan_change" | "impersonate" | "export" | "login" | "logout" | string;

export interface AdminKPIs {
  mrr: number;
  arr: number;
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  churned_tenants: number;
  total_users: number;
  active_users_30d: number;
  churn_rate_pct: number;
  trial_conversion_pct: number;
  avg_ltv: number;
  avg_cac: number;
  open_tickets: number;
  system_uptime_pct: number;
  mrr_growth_pct: number;
  new_tenants_30d: number;
  dau: number;
  mau: number;
  sessions_today: number;
  nps_score: number;
}

export interface RevenueDataPoint {
  month: string;
  mrr: number;
  arr: number;
  new_mrr: number;
  churned_mrr: number;
  expansion_mrr: number;
}

export interface AdminPlan {
  id: string;
  name: string;
  tier: PlanTier;
  price_monthly: number;
  price_annual: number;
  max_users: number;
  max_artists: number;
  max_storage_gb: number;
  features: string[];
  active_subscribers: number;
  mrr: number;
  color: string;
  /** Active plan (available for new subscriptions). Absent = active. */
  active?: boolean;
  /** Stripe integration (IDs of the product/price created in the Stripe dashboard). */
  stripe_product_id?: string;
  stripe_price_id?: string;
}

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: PlanTier;
  owner_email: string;
  users_count: number;
  artists_count: number;
  storage_used_mb: number;
  storage_limit_mb: number;
  mrr: number;
  created_at: string;
  last_active_at: string;
  country: string;
  trial_ends_at?: string;
}

export interface AdminSubscription {
  id: string;
  tenant_id: string;
  tenant_name: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  mrr: number;
  billing_cycle: BillingCycle;
  started_at: string;
  current_period_end: string;
  payment_method: string;
  trial_ends_at?: string;
  last_payment_at?: string;
  next_payment_at?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  /** The role's real slug (source: the `roles`/`org_members.role` table — no fixed enum, no artificial translation). */
  role_slug: string;
  /** The role's readable name, already resolved by the backend (`roles.name` table). */
  role_name: string;
  tenant_id: string;
  tenant_name: string;
  status: AdminUserStatus;
  /** null = unavailable (user without a match in Supabase Auth). */
  last_login: string | null;
  joined_at: string | null;
  /** null = unavailable (user without a match in Supabase Auth). */
  mfa_enabled: boolean | null;
  /** The Supabase Admin API does not expose an active session count — always null, never fabricated. */
  sessions_count: null;
}

export interface AdminAuditLog {
  id: string;
  action: AuditAction;
  entity: string;
  entity_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  tenant_id: string;
  tenant_name: string;
  ip_address: string;
  details?: string;
  created_at: string;
}

export interface AdminSecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  ip_address: string;
  user_email?: string;
  tenant_id?: string;
  tenant_name?: string;
  description: string;
  resolved: boolean;
  created_at: string;
}

export interface AdminSystemMetric {
  service: string;
  health: ServiceHealth;
  uptime_pct: number;
  latency_ms: number;
  requests_per_min: number;
  error_rate_pct: number;
  last_checked_at: string;
}

export interface AdminSupportTicket {
  id: string;
  subject: string;
  category: string;
  tenant_id: string;
  tenant_name: string;
  requester_email: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  first_response_at?: string;
  resolved_at?: string;
}

export interface AdminIntegration {
  id: string;
  name: string;
  provider: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  tenants_using: number;
  last_sync_at?: string;
  description: string;
  icon: string;
}

/**
 * Categories of GLOBAL providers of the SaaS platform (Admin Panel).
 * Distinct from the per-tenant integrations (App > Settings).
 */
export type PlatformCategory =
  | "core" | "billing" | "email" | "observability" | "storage"
  | "contracts" | "rights" | "social" | "music_platform"
  | "launch_connector" | "fiscal" | "marketing" | "api" | "webhook";

export type PlatformEnvironment = "production" | "sandbox" | "disabled";

/**
 * PlatformIntegrationProvider — a GLOBAL platform provider (SaaS Admin Panel).
 * Represents global availability, infrastructure, limits and operational status.
 * It does NOT represent a customer's connection (that is TenantIntegrationConnection).
 */
export interface PlatformIntegrationProvider {
  id: string;
  name: string;
  provider: string;
  category: PlatformCategory;
  status: IntegrationStatus;
  enabled: boolean;
  environment: PlatformEnvironment;
  availabilityByPlan: string[];
  tenantsUsing: number;
  requiresGlobalCredentials: boolean;
  requiresTenantCredentials: boolean;
  isCore: boolean;
  lastHealthCheckAt?: string;
  lastGlobalError?: string | null;
  webhookStatus?: "ok" | "failing" | "none";
  oauthStatus?: "ok" | "error" | "n/a";
  description: string;
  adminNotes?: string;
  auditUpdatedAt?: string;
}

/**
 * TenantIntegrationConnection — a CUSTOMER/workspace connection (App > Settings).
 * Represents the account connected by that tenant, credentials and sync.
 */
export interface TenantIntegrationConnection {
  id: string;
  tenantId: string;
  provider: string;
  status: IntegrationStatus;
  connected: boolean;
  connectedAccountName?: string | null;
  credentialType?: "oauth" | "api_key" | "none";
  scopes?: string[];
  lastSyncAt?: string | null;
  lastError?: string | null;
  configuredBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminNotification {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}
