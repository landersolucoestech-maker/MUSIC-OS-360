import { useCurrentRole } from "./useHasRole";

/**
 * Returns true if the current user has admin-level access
 * (super_admin, tenant_owner, or admin).
 *
 * Deny-by-default: returns false when role is null/undefined.
 * For more granular checks, use useHasRole().
 */
export function useIsAdmin() {
  const role = useCurrentRole();
  const adminRoles = ["super_admin", "tenant_owner", "owner", "admin"];
  return {
    // Deny by default — never grant admin when role is absent
    isAdmin:   role !== null && adminRoles.includes(role),
    isLoading: false,
    role,
  };
}
