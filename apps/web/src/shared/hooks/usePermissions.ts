import { useMemo } from "react";
import { useTenant } from "@/app/providers/TenantContext";
import type { TenantModuleKey, TenantModulePermission } from "@/app/providers/TenantContext";
import { AUTH_DISABLED, IS_DEV } from "@/shared/lib/env";
import { expandPermissionAliases, tenantModulePermissionKeys } from "@/shared/lib/permission-map";

/**
 * usePermissions — SINGLE frontend authorization source (PHASE 7 / hardened in 7.1).
 *
 * Consumes only `membership.permissions: string[]` (`resource:action` format),
 * exposed by the backend via /auth/context and stored in TenantContext.permissionKeys.
 * The frontend only hides/blocks/disables; the backend is the final authority.
 *
 * Behavior when `permissionKeys === null`:
 *  - DEV/MOCK/AUTH_DISABLED → permissive (does not block dev).
 *  - real PRODUCTION → does NOT open (treated as "loading/missing" → denies). `isLoadingPermissions`
 *    signals the state so the gates render a safe fallback.
 *
 * It is NOT an authorization matrix: the decision comes only from the `membership.permissions` set.
 */
export interface UsePermissions {
  permissions: string[];
  isLoadingPermissions: boolean;
  hasPermission: (permission: string) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  can: (resource: string, action: string) => boolean;
  canModule: (module: TenantModuleKey, action: keyof TenantModulePermission) => boolean;
}

export function usePermissions(): UsePermissions {
  const { permissionKeys } = useTenant();

  return useMemo<UsePermissions>(() => {
    // Permissive ONLY outside production (dev/mock/auth-disabled). In real production,
    // missing permissions NEVER grant access.
    const devPermissive = AUTH_DISABLED || IS_DEV;
    const isLoadingPermissions = !devPermissive && permissionKeys === null;
    const granted = expandPermissionAliases(permissionKeys ?? []);

    const hasPermission = (permission: string): boolean =>
      devPermissive ? true : granted.has(permission);

    return {
      permissions: permissionKeys ?? [],
      isLoadingPermissions,
      hasPermission,
      hasAllPermissions: (permissions) =>
        devPermissive ? true : permissions.every((p) => granted.has(p)),
      hasAnyPermission: (permissions) =>
        devPermissive ? true : permissions.length === 0 ? true : permissions.some((p) => granted.has(p)),
      can: (resource, action) => hasPermission(`${resource}:${action}`),
      canModule: (module, action) => {
        if (devPermissive) return true;
        return tenantModulePermissionKeys(module, action).some((k) => granted.has(k));
      },
    };
  }, [permissionKeys]);
}
