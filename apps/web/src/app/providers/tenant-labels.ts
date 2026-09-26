/**
 * app/providers/tenant-labels.ts
 *
 * Label constants for tenant types.
 * Separated from TenantContext.tsx for Vite Fast Refresh compatibility.
 * (TenantContext.tsx may only export React components and hooks.)
 */

import { getAccessToken } from "@/shared/lib/api-client";
import type {
  TenantPlan,
  TenantBillingStatus,
  TenantIndustry,
  TenantRole,
  TenantPermissions,
  TenantModuleKey,
  TenantModulePermission,
} from "./TenantContext";

export type { TenantPlan, TenantBillingStatus, TenantIndustry, TenantRole };

/** Plan display labels */
export const PLAN_LABEL: Record<TenantPlan, string> = {
  starter:      "Starter",
  professional: "Professional",
  enterprise:   "Enterprise",
};

/** Industry display labels */
export const INDUSTRY_LABEL: Record<TenantIndustry, string> = {
  gravadora:     "Gravadora",
  editora:       "Editora Musical",
  distribuidora: "Distribuidora",
  agencia:       "Agência Artística",
  publisher:     "Publisher",
  outro:         "Outro",
};

/** Billing status labels */
export const BILLING_STATUS_LABEL: Record<TenantBillingStatus, string> = {
  active:        "Ativo",
  trial:         "Trial",
  past_due:      "Em atraso",
  payment_grace: "Pagamento pendente",
  read_only:     "Somente leitura",
  suspended:     "Suspenso",
  cancelled:     "Cancelado",
};

/** Role labels */
export const ROLE_LABEL: Record<TenantRole, string> = {
  owner:   "Proprietário",
  admin:   "Administrador",
  manager: "Gerente",
  editor:  "Editor",
  viewer:  "Visualizador",
};

// ─── ROLE_PERMISSIONS + helpers ───────────────────────────────────────────────

const FULL_PERMISSION: TenantModulePermission = { read: true, write: true, delete: true, export: true };
const READ_ONLY:       TenantModulePermission = { read: true, write: false, delete: false, export: true };
const NO_ACCESS:       TenantModulePermission = { read: false, write: false, delete: false, export: false };

const MODULE_KEYS: TenantModuleKey[] = [
  "artists", "catalog", "releases", "contracts",
  "accounting", "crm", "marketing", "events",
  "inventory", "rh", "monitoring", "licensing",
  "projects", "leads", "audit", "settings", "musicchat",
];

/** Role-based default permissions */
export const ROLE_PERMISSIONS: Record<TenantRole, TenantPermissions> = {
  owner:   Object.fromEntries(MODULE_KEYS.map(k => [k, FULL_PERMISSION])) as TenantPermissions,
  admin:   Object.fromEntries(MODULE_KEYS.map(k => [k, FULL_PERMISSION])) as TenantPermissions,
  manager: Object.fromEntries(MODULE_KEYS.map(k => [k, k === "audit" || k === "settings" ? READ_ONLY : FULL_PERMISSION])) as TenantPermissions,
  editor:  Object.fromEntries(MODULE_KEYS.map(k => [k, k === "audit" || k === "settings" ? NO_ACCESS : { read: true, write: true, delete: false, export: true }])) as TenantPermissions,
  viewer:  Object.fromEntries(MODULE_KEYS.map(k => [k, k === "audit" || k === "settings" ? NO_ACCESS : READ_ONLY])) as TenantPermissions,
};

/** Derives permissions from the real JWT. */
export function getPermissionsFromToken(): TenantPermissions {
  try {
    const token = getAccessToken();
    if (!token) return ROLE_PERMISSIONS.viewer;
    const base64Payload = token.split(".")[1];
    if (!base64Payload) return ROLE_PERMISSIONS.viewer;
    const payload = JSON.parse(atob(base64Payload)) as { role?: TenantRole };
    const role: TenantRole =
      payload.role && payload.role in ROLE_PERMISSIONS
        ? payload.role
        : "viewer";
    return ROLE_PERMISSIONS[role];
  } catch {
    return ROLE_PERMISSIONS.viewer;
  }
}
