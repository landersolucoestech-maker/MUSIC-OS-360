/**
 * shared/components/RequirePermission.tsx
 *
 * RBAC gate over the SINGLE SOURCE of permissions (membership.permissions, via usePermissions).
 * Renders `children` only if the user has the permission; otherwise `fallback`.
 *
 * While permissions are loading in production (permissionKeys still null), renders
 * `loadingFallback` (null by default = nothing visible and non-interactive) — NEVER fails open.
 *
 * Usage:
 *   <RequirePermission module="accounting" action="write">
 *     <Button>Nova Transação</Button>
 *   </RequirePermission>
 */
import { usePermissions } from "@/shared/hooks/usePermissions";
import type { TenantModuleKey, TenantModulePermission } from "@/app/providers/TenantContext";

interface RequirePermissionProps {
  module:   TenantModuleKey;
  action:   keyof TenantModulePermission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

export function RequirePermission({
  module,
  action,
  children,
  fallback = null,
  loadingFallback = null,
}: RequirePermissionProps) {
  const { canModule, isLoadingPermissions } = usePermissions();
  if (isLoadingPermissions) return <>{loadingFallback}</>;
  return canModule(module, action) ? <>{children}</> : <>{fallback}</>;
}

/** Semantic alias — permission gate. */
export const PermissionGate = RequirePermission;

/**
 * Hook companion — retorna true/false sem wrapper JSX.
 *   const canWrite = useHasPermission("accounting", "write");
 */
export function useHasPermission(
  module: TenantModuleKey,
  action: keyof TenantModulePermission,
): boolean {
  const { canModule } = usePermissions();
  return canModule(module, action);
}
