import { useAuth } from "@/app/providers/AuthContext";

/**
 * All 12 MUSIC OS 360 roles — mirrors server/src/common/types/roles.ts.
 */
export type AppRole =
  | "super_admin"
  | "tenant_owner"
  | "owner"
  | "admin"
  | "accounting"
  | "juridico"
  | "artista"
  | "produtor"
  | "marketing_manager"
  | "comercial"
  | "colaborador"
  | "rh_manager"
  // English aliases (RBAC expand step): same level as the Portuguese slug still persisted
  // in org_members.role / the JWT. Never remove the Portuguese members before the contract step.
  | "legal"
  | "sales"
  | "producer"
  | "collaborator"
  | "hr_manager"
  | "viewer";

/** Numeric hierarchy: lower = more privileged (mirrors backend ROLE_HIERARCHY). */
const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin:       0,
  tenant_owner:      1,
  owner:             1,
  admin:             2,
  accounting:        3,
  juridico:          3,
  rh_manager:        3,
  legal:             3,
  hr_manager:        3,
  marketing_manager: 4,
  comercial:         4,
  produtor:          4,
  sales:             4,
  producer:          4,
  artista:           5,
  colaborador:       6,
  collaborator:      6,
  viewer:            7,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin:       "Super Admin",
  tenant_owner:      "Proprietário",
  owner:             "Proprietário",
  admin:             "Administrador",
  accounting:        "Gestor Accounting",
  juridico:          "Jurídico / Contratos",
  artista:           "Artista",
  produtor:          "Produtor Musical",
  marketing_manager: "Marketing",
  comercial:         "Comercial",
  colaborador:       "Colaborador",
  rh_manager:        "Recursos Humanos",
  legal:             "Jurídico / Contratos",
  sales:             "Comercial",
  producer:          "Produtor Musical",
  collaborator:      "Colaborador",
  hr_manager:        "Recursos Humanos",
  viewer:            "Visualizador",
};

/** Returns the current user's role from the JWT. */
export function useCurrentRole(): AppRole | null {
  const { user } = useAuth();
  if (!user) return null;
  const raw = (user.user_metadata?.role as string) ?? (user as Record<string, unknown>)["role"];
  return (raw as AppRole) ?? null;
}

/**
 * Returns true if the current user has the exact role or a role with equal/higher
 * privilege level (lower hierarchy number).
 *
 * @example
 *   useHasRole('admin')          // true for admin, tenant_owner, super_admin
 *   useHasRole('viewer')         // true for all roles
 *   useHasRole('tenant_owner')   // true only for tenant_owner and super_admin
 */
export function useHasRole(minimumRole: AppRole): boolean {
  const role = useCurrentRole();
  if (!role) return false;
  const userLevel = ROLE_HIERARCHY[role] ?? 99;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;
  return userLevel <= requiredLevel;
}

/**
 * Returns true if the current user has exactly the given role.
 */
export function useIsExactRole(role: AppRole): boolean {
  const current = useCurrentRole();
  return current === role;
}

