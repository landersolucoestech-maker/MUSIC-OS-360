/**
 * permission-map.ts
 *
 * Translation of module NAMES (UI) to the backend `resource`, and of the UI's coarse
 * action (read/write/delete/export) to `resource:action` actions.
 *
 * IMPORTANT: this is NOT an authorization matrix. It is only a map of names.
 * Authorization comes exclusively from `membership.permissions` (see usePermissions).
 */
import type { TenantModuleKey, TenantModulePermission } from "@/app/providers/TenantContext";

/** Module name (UI) → backend resource. */
export const MODULE_RESOURCE: Record<string, string> = {
  artists: "artist",
  catalog: "catalog",
  releases: "releases",
  contracts: "contracts",
  accounting: "accounting",
  crm: "crm",
  marketing: "marketing",
  events: "events",
  inventory: "inventory",
  rh: "rh",
  monitoring: "monitoring",
  licensing: "licensing",
  projects: "projects",
  leads: "leads",
  settings: "settings",
  audit: "analytics",
  musicchat: "settings",
  admin: "settings",
};

/** UI coarse action → backend `resource:action` actions (any one satisfies). */
const TENANT_ACTION_BACKEND: Record<keyof TenantModulePermission, string[]> = {
  read: ["read"],
  write: ["update", "create"],
  delete: ["delete"],
  export: ["export"],
};

/** Converts (module, coarse action) → list of candidate `resource:action` keys. */
export function tenantModulePermissionKeys(
  module: TenantModuleKey,
  action: keyof TenantModulePermission,
): string[] {
  const resource = MODULE_RESOURCE[module] ?? module;
  return (TENANT_ACTION_BACKEND[action] ?? []).map((a) => `${resource}:${a}`);
}
