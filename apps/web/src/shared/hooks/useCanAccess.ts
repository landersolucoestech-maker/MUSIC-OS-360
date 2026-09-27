/**
 * useCanAccess — gate by (module, action) over the SINGLE source of permissions.
 *
 * PHASE 7: NO longer queries a local matrix (PERMISSION_MATRIX) or role. Translates
 * `module + action` → `resource:action` (via MODULE_RESOURCE — names only) and
 * queries usePermissions(), whose only source is membership.permissions.
 */
import { usePermissions } from "./usePermissions";
import { MODULE_RESOURCE } from "@/shared/lib/permission-map";

export type PermissionModule =
  | "catalog"
  | "contracts"
  | "accounting"
  | "artists"
  | "crm"
  | "marketing"
  | "rh"
  | "settings"
  | "admin";

export type PermissionAction = "read" | "create" | "update" | "delete" | "export" | "manage";

/** UI action → backend `resource:action` actions (any one satisfies it). */
const ACTION_BACKEND: Record<PermissionAction, string[]> = {
  read: ["read"],
  create: ["create"],
  update: ["update"],
  delete: ["delete"],
  export: ["export"],
  manage: ["update", "delete"],
};

/** true when the user has the action in the module, according to membership.permissions. */
export function useCanAccess(module: PermissionModule, action: PermissionAction): boolean {
  const { hasAnyPermission } = usePermissions();
  const resource = MODULE_RESOURCE[module] ?? module;
  return hasAnyPermission(ACTION_BACKEND[action].map((a) => `${resource}:${a}`));
}

/** Actions allowed for the user in the module (derived from membership.permissions). */
export function useModuleActions(module: PermissionModule): PermissionAction[] {
  const { can } = usePermissions();
  const resource = MODULE_RESOURCE[module] ?? module;
  return (["read", "create", "update", "delete", "export"] as PermissionAction[]).filter((a) =>
    can(resource, a),
  );
}
