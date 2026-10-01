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
  hr: "hr",
  /** Deprecated alias of `hr` (legacy Portuguese module key), kept one release for stale callers. */
  rh: "hr",
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

/**
 * RBAC `hr` module key: persisted permissions are still `rh:*` until the gated S4b rename
 * (docs/engineering/rbac-retirement-plan.md), the canonical English key is `hr:*`. Both spellings
 * are accepted on read; a grant of one is exactly a grant of the other (never widened).
 */
const HR_PERMISSION_PREFIXES = ["hr:", "rh:"] as const;

/** Candidate spellings of a permission key (the key itself first, then its HR twin). */
export function permissionKeyEquivalents(key: string): string[] {
  for (const prefix of HR_PERMISSION_PREFIXES) {
    if (key.startsWith(prefix)) {
      const other = HR_PERMISSION_PREFIXES.find((p) => p !== prefix) as string;
      return [key, `${other}${key.slice(prefix.length)}`];
    }
  }
  return [key];
}

/** Granted keys plus their HR twins (dual-read of `rh:*` / `hr:*`). */
export function expandPermissionAliases(keys: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const key of keys) for (const k of permissionKeyEquivalents(key)) out.add(k);
  return out;
}

/** Converts (module, coarse action) → list of candidate `resource:action` keys. */
export function tenantModulePermissionKeys(
  module: TenantModuleKey,
  action: keyof TenantModulePermission,
): string[] {
  const resource = MODULE_RESOURCE[module] ?? module;
  return (TENANT_ACTION_BACKEND[action] ?? []).flatMap((a) => permissionKeyEquivalents(`${resource}:${a}`));
}
