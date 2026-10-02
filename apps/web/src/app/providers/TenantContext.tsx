import React, { createContext, useContext, useState, useEffect } from "react";
import type { FeatureFlags } from "@/shared/lib/feature-flags";
import { DEFAULT_FEATURE_FLAGS, canonicalFeatureKeys } from "@/shared/lib/feature-flags";
import { AUTH_DISABLED, DEV_AUTH_BYPASS, IS_DEV } from "@/shared/lib/env";
import { ROLE_PERMISSIONS } from "./tenant-labels";
import { tenantModulePermissionKeys } from "@/shared/lib/permission-map";
import { api, getAccessToken } from "@/shared/lib/api-client";
import { IntegrationError } from "@/shared/lib/errors";
import { useAuth } from "./AuthContext";
import type { SaasAuthContext } from "@/shared/types/saas-context";
import { DEFAULT_ORGANIZATION_INDUSTRY, type OrganizationIndustry } from "@/modules/auth/constants/organization-industry";
import { SYSTEM_REGIONAL_SETTINGS } from "@/shared/lib/system-regional-settings";

// ─── Plan & billing ───────────────────────────────────────────────────────────

export type TenantPlan           = "starter" | "professional" | "enterprise";
export type TenantBillingStatus  =
  | "active" | "trial" | "suspended" | "cancelled"
  // Delinquency enforcement states (source of truth = backend tenant_billing_state)
  | "past_due" | "payment_grace" | "read_only";
export type TenantIndustry       = OrganizationIndustry;

// ─── RBAC — Permissions ───────────────────────────────────────────────────────

export type TenantRole = "owner" | "admin" | "manager" | "editor" | "viewer";

export interface TenantModulePermission {
  read:   boolean;
  write:  boolean;
  delete: boolean;
  export: boolean;
}

export type TenantModuleKey =
  | "artists" | "catalog" | "releases" | "contracts"
  | "accounting" | "crm" | "marketing" | "events"
  | "inventory" | "hr" | "monitoring" | "licensing"
  | "projects" | "leads" | "audit" | "settings" | "musicchat";

export type TenantPermissions = Record<TenantModuleKey, TenantModulePermission>;

// ROLE_PERMISSIONS available in ./tenant-labels

// ─── Tenant config (branding + UX per tenant) ─────────────────────────────────

export interface TenantConfig {
  primaryColor?:    string;
  logoUrl?:         string;
  faviconUrl?:      string;
  emailFromName?:   string;
  emailFromAddr?:   string;
  supportEmail?:    string;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export type OnboardingStep =
  | "company_profile"
  | "invite_team"
  | "first_artist"
  | "first_catalog_item"
  | "first_contract"
  | "connect_integration"
  | "complete";

export interface TenantOnboarding {
  completed:    boolean;
  currentStep:  OnboardingStep;
  steps: Record<OnboardingStep, boolean>;
}

const DEFAULT_ONBOARDING: TenantOnboarding = {
  completed:   true,
  currentStep: "complete",
  steps: {
    company_profile:      true,
    invite_team:          true,
    first_artist:         true,
    first_catalog_item:   true,
    first_contract:       true,
    connect_integration:  false,
    complete:             false,
  },
};

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface TenantBilling {
  status:          TenantBillingStatus;
  trialEndsAt?:    string;
  currentPeriodEnd?: string;
  seats:           number;
  seatsUsed:       number;
  planId?:         string;
  customerId?:     string;
  subscriptionId?: string;
  /** Enforcement: exposed by the backend (tenant_billing_state / GET /billing/subscription). */
  graceUntil?:     string;
  amountDue?:      number;
  invoiceUrl?:     string;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface Tenant {
  id:          string;
  name:        string;
  slug:        string;
  plan:        TenantPlan;
  industry:    TenantIndustry;
  website?:    string;
  cnpj?:       string;
  phone?:      string;
  address?:    string;
  features:    FeatureFlags;
  permissions: TenantPermissions;
  config:      TenantConfig;
  billing:     TenantBilling;
  onboarding:  TenantOnboarding;
  meta: {
    createdAt:  string;
    timezone:   string;
    locale:     string;
    currency:   string;
    version:    number;
  };
}

// getPermissionsFromToken available in ./tenant-labels

// ─── Empty base tenant (no fictitious data; filled by the real API) ──────────

const BASE_TENANT: Tenant = {
  id:       "",
  name:     "",
  slug:     "",
  plan:     "starter",
  industry: DEFAULT_ORGANIZATION_INDUSTRY,
  cnpj:     "",
  phone:    "",
  address:  "",
  features:    DEFAULT_FEATURE_FLAGS,
  permissions: ROLE_PERMISSIONS.owner,
  config: {},
  billing: {
    status:            "active",
    seats:             0,
    seatsUsed:         0,
    currentPeriodEnd:  "",
  },
  onboarding: DEFAULT_ONBOARDING,
  meta: {
    createdAt: "",
    timezone:  SYSTEM_REGIONAL_SETTINGS.timezone,
    locale:    SYSTEM_REGIONAL_SETTINGS.locale,
    currency:  SYSTEM_REGIONAL_SETTINGS.currency,
    version:   1,
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface TenantContextType {
  tenant:           Tenant;
  setTenant:        React.Dispatch<React.SetStateAction<Tenant>>;
  /** SINGLE source of authorization: membership.permissions (resource:action). null = not loaded yet. */
  permissionKeys:   string[] | null;
  /** true while the first call to /auth/context has not resolved yet (success or error). */
  contextLoading:   boolean;
  /**
   * Part 76 — before, a failure on /auth/context (e.g. a 503 caused by an unavailable
   * database dependency) was silently swallowed: `tenant` stayed
   * forever on the empty placeholder, without any error signal — giving the
   * impression of "loading forever" when the call had actually
   * failed for good. Sanitized message (never the raw backend error).
   */
  contextError:     string | null;
  isFeatureEnabled: (flag: keyof FeatureFlags) => boolean;
  hasPermission:    (module: TenantModuleKey, action: keyof TenantModulePermission) => boolean;
  canRead:          (module: TenantModuleKey) => boolean;
  canWrite:         (module: TenantModuleKey) => boolean;
  canDelete:        (module: TenantModuleKey) => boolean;
  canExport:        (module: TenantModuleKey) => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Mirrors, for display only, the real tenant-zero (LANDER RECORDS) that the
// backend already uses under AUTH_DISABLED — the source of truth is
// apps/api/src/database/tenant-zero.constants.ts (TENANT_ZERO_TENANT_ID),
// frozen and covered by a snapshot there. It is not used for authorization: the
// backend never trusts the tenant.id sent by the client under AUTH_DISABLED,
// it already injects the real tenant-zero via a guard regardless of what the UI
// shows here.
const AUTH_DISABLED_TENANT_ID = "a900b3a8-fa1c-5a6b-a852-1b0689e27fe3";

// DEV ONLY (VITE_DEV_AUTH_BYPASS=true) — central synthetic tenant, IDs
// deliberately distinct from AUTH_DISABLED_TENANT_ID above (see the note in
// AuthContext.tsx: this flag assumes no corresponding bypass in the
// backend). Owner permissions to unlock all local navigation/UI.
const DEV_AUTH_BYPASS_TENANT_ID = "00000000-0000-4000-8000-000000000002";

function buildInitialTenant(): Tenant {
  if (AUTH_DISABLED) {
    return {
      ...BASE_TENANT,
      id: AUTH_DISABLED_TENANT_ID,
      name: "LANDER RECORDS",
      slug: "lander-records",
      permissions: ROLE_PERMISSIONS.owner,
    };
  }
  if (DEV_AUTH_BYPASS) {
    return {
      ...BASE_TENANT,
      id: DEV_AUTH_BYPASS_TENANT_ID,
      name: "DEV BYPASS TENANT",
      slug: "dev-bypass",
      permissions: ROLE_PERMISSIONS.owner,
    };
  }
  return {
    ...BASE_TENANT,
    id:          "",
    name:        "MUSIC OS 360",
    slug:        "",
    plan:        "starter",
    permissions: ROLE_PERMISSIONS.viewer,
    onboarding: DEFAULT_ONBOARDING,
  };
}

/**
 * Maps an AppRole string (from AuthContext / shared/types/auth.ts) to the
 * TenantRole key used by ROLE_PERMISSIONS.
 * "tenant_owner" → "owner", everything else is a direct match or falls back to "viewer".
 */
function appRoleToTenantRole(appRole: string): TenantRole {
  if (appRole === "tenant_owner") return "owner";
  if (appRole in ROLE_PERMISSIONS)  return appRole as TenantRole;
  return "viewer";
}

function normalizePlan(plan: string | undefined): TenantPlan {
  return plan === "professional" || plan === "enterprise" ? plan : "starter";
}

function normalizeFeatures(rawFeatures: Record<string, unknown>): FeatureFlags {
  const next = { ...DEFAULT_FEATURE_FLAGS };
  // Dual-read: a tenant row not yet backfilled may still carry `moduleRh` (now `moduleHr`).
  const features = canonicalFeatureKeys(rawFeatures);
  for (const key of Object.keys(next) as Array<keyof FeatureFlags>) {
    if (typeof features[key] === "boolean") next[key] = features[key] as boolean;
  }
  return next;
}

function normalizeOnboarding(settings: Record<string, unknown>): TenantOnboarding {
  const raw = settings["onboarding"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_ONBOARDING;
  }
  const onboarding = raw as Record<string, unknown>;
  const completed = onboarding["completed"] === true;
  return {
    ...DEFAULT_ONBOARDING,
    completed,
    currentStep: completed ? "complete" : "company_profile",
    steps: {
      ...DEFAULT_ONBOARDING.steps,
      company_profile: completed,
      complete: completed,
    },
  };
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [tenant, setTenant] = useState<Tenant>(buildInitialTenant);
  // SINGLE source of authorization: resource:action permissions coming from membership.permissions.
  // null = not loaded yet (or MOCK/AUTH_DISABLED) → usePermissions does a UI fail-open.
  const [permissionKeys, setPermissionKeys] = useState<string[] | null>(null);
  const [contextLoading, setContextLoading] = useState<boolean>(!(AUTH_DISABLED || DEV_AUTH_BYPASS));
  const [contextError, setContextError] = useState<string | null>(null);

  useEffect(() => {
    if (AUTH_DISABLED || DEV_AUTH_BYPASS) return;
    if (!session?.access_token) return;

    let active = true;
    setContextLoading(true);
    setContextError(null);
    api.get<SaasAuthContext>("/auth/context")
      .then((context) => {
        if (!active) return;
        setContextLoading(false);
        setContextError(null);
        const tenantRole = appRoleToTenantRole(context.membership.role);
        setPermissionKeys(Array.isArray(context.membership.permissions) ? context.membership.permissions : []);
        setTenant(prev => ({
          ...prev,
          id:          context.workspace.id || prev.id,
          name:        context.workspace.name || prev.name,
          slug:        context.workspace.slug || prev.slug,
          plan:        normalizePlan(context.workspace.plan),
          features:    normalizeFeatures(context.workspace.features),
          onboarding:  normalizeOnboarding(context.workspace.settings),
          config: {
            ...prev.config,
            logoUrl: typeof context.workspace.settings["logoUrl"] === "string"
              ? context.workspace.settings["logoUrl"] as string
              : prev.config.logoUrl,
          },
          permissions: ROLE_PERMISSIONS[tenantRole],
          billing: {
            ...prev.billing,
            planId: context.workspace.plan || prev.billing.planId,
          },
        }));
        devTenantLog("Tenant synced via /auth/context:", {
          id: context.workspace.id,
          role: context.membership.role,
          permissions: context.membership.permissions.length,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        devTenantLog("Failed to sync /auth/context; falling back to JWT/localStorage", error);
        setContextLoading(false);
        setContextError(
          error instanceof IntegrationError && error.statusCode === 503
            ? "Serviço de contexto indisponível — o banco de dados da aplicação não respondeu."
            : "Não foi possível carregar o contexto da organização.",
        );
      });

    return () => { active = false; };
  }, [session?.access_token]);

  const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => tenant.features[flag] ?? false;

  // SINGLE source of authorization: membership.permissions (resource:action).
  // Permissive ONLY in dev/mock/auth-disabled. In production, absent permissions
  // (permissionKeys === null, still loading or unavailable) do NOT open — fail-closed.
  const hasPermission = (module: TenantModuleKey, action: keyof TenantModulePermission): boolean => {
    if (AUTH_DISABLED || IS_DEV) return true;
    if (permissionKeys === null) return false;
    const keys = tenantModulePermissionKeys(module, action);
    return keys.some((key) => permissionKeys.includes(key));
  };

  const canRead   = (m: TenantModuleKey) => hasPermission(m, "read");
  const canWrite  = (m: TenantModuleKey) => hasPermission(m, "write");
  const canDelete = (m: TenantModuleKey) => hasPermission(m, "delete");
  const canExport = (m: TenantModuleKey) => hasPermission(m, "export");

  return (
    <TenantContext.Provider value={{ tenant, setTenant, permissionKeys, contextLoading, contextError, isFeatureEnabled, hasPermission, canRead, canWrite, canDelete, canExport }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextType {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within a TenantProvider");
  return ctx;
}

// ─── DEV logging ──────────────────────────────────────────────────────────────

function devTenantLog(label: string, data?: unknown): void {
  if (import.meta.env.DEV !== true) return;
  if (data !== undefined) {
    console.log(`[MUSIC OS 360 Tenant] ${label}`, data);
  } else {
    console.log(`[MUSIC OS 360 Tenant] ${label}`);
  }
}

// ─── JWT claim parser ─────────────────────────────────────────────────────────

interface JwtAppClaims {
  role?:         string;
  org_id?:       string;
  app_metadata?: { role?: string; org_id?: string };
}

function parseJwtClaims(token: string): JwtAppClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as JwtAppClaims;
  } catch { return null; }
}

/**
 * useSyncTenantFromJWT — syncs permissions + tenant metadata.
 *
 * Data sources (by descending priority):
 *   1. JWT app_metadata.role + app_metadata.org_id (injected by the Supabase Hook)
 *   2. JWT top-level role / org_id (fallback for legacy tokens)
 *
 * Re-runs on:
 *   • a userEmail change (initial login)
 *   • the window event "musicos360:auth:tokenRefreshed" (token refresh)
 */
export function useSyncTenantFromJWT(_userEmail?: string): void {
  const { setTenant } = useTenant();

  // Internal sync function — shared by the two effects below
  const syncFromJwt = React.useCallback(() => {
    
    if (AUTH_DISABLED || DEV_AUTH_BYPASS) return;

    // JWT claims (app_metadata.role + app_metadata.org_id via Hook)
    const token = getAccessToken();
    if (!token) {
      devTenantLog("No in-memory token: waiting for login");
      return;
    }

    const decoded = parseJwtClaims(token);
    if (!decoded) return;

    // Prioridade: app_metadata (Hook) → top-level (fallback)
    const claimRole  = decoded.app_metadata?.role   ?? decoded.role;
    const claimOrgId = decoded.app_metadata?.org_id ?? decoded.org_id;

    devTenantLog("JWT claims read:", {
      org_id:  claimOrgId ?? "(ausente — ativar Custom Access Token Hook no Supabase)",
      role:    claimRole  ?? "(ausente)",
      source:  decoded.app_metadata?.org_id ? "app_metadata (hook)" : "top-level (fallback)",
    });

    if (!claimRole) return;
    const tenantRole = appRoleToTenantRole(claimRole);
    if (!(tenantRole in ROLE_PERMISSIONS)) return;

    setTenant(prev => ({
      ...prev,
      id:          claimOrgId ?? prev.id,
      permissions: ROLE_PERMISSIONS[tenantRole],
    }));
    devTenantLog(`Permissions elevated for role "${tenantRole}" (org: ${claimOrgId ?? "kept"})`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 1: fires on login / when the user's email changes
  useEffect(() => {
    syncFromJwt();
  }, [syncFromJwt]);

  // Effect 2: fires when AuthContext renews the token (TOKEN_REFRESHED)
  // without a reload — the hook's new claims become active immediately
  useEffect(() => {
    const handler = () => {
      devTenantLog("TOKEN_REFRESHED received: re-syncing JWT claims");
      syncFromJwt();
    };
    window.addEventListener("musicos360:auth:tokenRefreshed", handler);
    return () => { window.removeEventListener("musicos360:auth:tokenRefreshed", handler); };
  }, [syncFromJwt]);
}

// Label constants (PLAN_LABEL, INDUSTRY_LABEL, BILLING_STATUS_LABEL, ROLE_LABEL)
// and ROLE_PERMISSIONS available in ./tenant-labels
