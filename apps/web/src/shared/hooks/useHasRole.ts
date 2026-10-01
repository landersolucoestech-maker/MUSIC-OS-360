import { useAuth } from "@/app/providers/AuthContext";
import { toCanonicalRoleSlug } from "@music-os-360/types";

/**
 * All 12 MUSIC OS 360 roles — mirrors server/src/common/types/roles.ts.
 */
export type AppRole =
  | "super_admin"
  | "tenant_owner"
  | "owner"
  | "admin"
  | "accounting"
  | "viewer"
  | "artist"
  // Canonical English slugs (written by the API since RBAC S4a). Machine values are English;
  // Portuguese appears only in ROLE_LABELS.
  | "legal"
  | "sales"
  | "producer"
  | "collaborator"
  | "hr_manager"
  | "marketing_manager"
  // Legacy slugs: still persisted in older org_members rows / JWTs and accepted with the exact rank
  // of their canonical slug until the gated S5 retirement. Never remove before then.
  | "juridico"
  | "artista"
  | "produtor"
  | "comercial"
  | "colaborador"
  | "rh_manager";

/**
 * Numeric hierarchy, keyed by CANONICAL slug only: lower = more privileged (mirrors the backend
 * ROLE_HIERARCHY). Legacy slugs are resolved through toCanonicalRoleSlug(), so a legacy slug and its
 * canonical slug can never drift apart.
 */
const ROLE_RANK: Readonly<Record<string, number>> = {
  super_admin:       0,
  tenant_owner:      1,
  owner:             1,
  admin:             2,
  accounting:        3,
  legal:             3,
  hr_manager:        3,
  marketing_manager: 4,
  sales:             4,
  producer:          4,
  artist:            5,
  collaborator:      6,
  viewer:            7,
};

function roleRank(role: string): number | undefined {
  const canonical = toCanonicalRoleSlug(role);
  return Object.prototype.hasOwnProperty.call(ROLE_RANK, canonical) ? ROLE_RANK[canonical] : undefined;
}

/** PT-BR display labels (labels only; never persisted or compared). */
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin:       "Super Admin",
  tenant_owner:      "Proprietário",
  owner:             "Proprietário",
  admin:             "Administrador",
  accounting:        "Gestor Accounting",
  artist:            "Artista",
  legal:             "Jurídico / Contratos",
  sales:             "Comercial",
  producer:          "Produtor Musical",
  collaborator:      "Colaborador",
  hr_manager:        "Recursos Humanos",
  marketing_manager: "Marketing",
  viewer:            "Visualizador",
  juridico:          "Jurídico / Contratos",
  artista:           "Artista",
  produtor:          "Produtor Musical",
  comercial:         "Comercial",
  colaborador:       "Colaborador",
  rh_manager:        "Recursos Humanos",
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
  const userLevel = roleRank(role) ?? 99;
  const requiredLevel = roleRank(minimumRole) ?? 0;
  return userLevel <= requiredLevel;
}

/**
 * Returns true if the current user has exactly the given role.
 */
export function useIsExactRole(role: AppRole): boolean {
  const current = useCurrentRole();
  return current === role;
}

