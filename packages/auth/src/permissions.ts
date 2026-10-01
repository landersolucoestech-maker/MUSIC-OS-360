import { ROLES, type Role } from "./roles";

// ─── Resource Keys ────────────────────────────────────────────────────────────

export const RESOURCES = {
  ARTIST: "artist",
  CATALOG: "catalog",
  CONTRACTS: "contracts",
  ACCOUNTING: "accounting",
  CRM: "crm",
  MARKETING: "marketing",
  MONITORING: "monitoring",
  RELEASES: "releases",
  PROJECTS: "projects",
  EVENTS: "events",
  INVENTORY: "inventory",
  /** Canonical English key; persisted rows are still `rh:*` until the gated S4b rename (dual-read). */
  HR: "hr",
  /** @deprecated legacy spelling of HR, removed with S5. */
  RH: "rh",
  SETTINGS: "settings",
  LICENSING: "licensing",
  LEADS: "leads",
  ANALYTICS: "analytics",
} as const;

export type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];

// ─── Action Keys ──────────────────────────────────────────────────────────────

export const ACTIONS = {
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  EXPORT: "export",
  APPROVE: "approve",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export type Permission = `${Resource}:${Action}`;

// ─── Role → Permission matrix ─────────────────────────────────────────────────

const ALL_ACTIONS: Action[] = Object.values(ACTIONS);
const READ_ONLY: Action[] = [ACTIONS.READ];
const WRITE_NO_DELETE: Action[] = [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.EXPORT];

function allResources(actions: Action[]): Permission[] {
  return Object.values(RESOURCES).flatMap((r) =>
    actions.map((a) => `${r}:${a}` as Permission),
  );
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.OWNER]: allResources(ALL_ACTIONS),
  [ROLES.ADMIN]: allResources(ALL_ACTIONS),
  [ROLES.MANAGER]: allResources(WRITE_NO_DELETE),
  [ROLES.FINANCIAL]: [
    ...([RESOURCES.ACCOUNTING, RESOURCES.PROJECTS] as Resource[]).flatMap((r) =>
      ALL_ACTIONS.map((a) => `${r}:${a}` as Permission),
    ),
    ...([RESOURCES.ARTIST, RESOURCES.CONTRACTS] as Resource[]).flatMap((r) =>
      READ_ONLY.map((a) => `${r}:${a}` as Permission),
    ),
  ],
  [ROLES.MARKETING]: [
    ...([RESOURCES.MARKETING, RESOURCES.ANALYTICS, RESOURCES.RELEASES] as Resource[]).flatMap(
      (r) => ALL_ACTIONS.map((a) => `${r}:${a}` as Permission),
    ),
    ...([RESOURCES.ARTIST, RESOURCES.CATALOG] as Resource[]).flatMap((r) =>
      READ_ONLY.map((a) => `${r}:${a}` as Permission),
    ),
  ],
  [ROLES.ARTIST]: [
    ...([RESOURCES.ARTIST, RESOURCES.CATALOG, RESOURCES.RELEASES] as Resource[]).flatMap(
      (r) => READ_ONLY.map((a) => `${r}:${a}` as Permission),
    ),
  ],
  [ROLES.RADIO]: [
    ...([RESOURCES.CATALOG, RESOURCES.MONITORING, RESOURCES.LICENSING] as Resource[]).flatMap(
      (r) => READ_ONLY.map((a) => `${r}:${a}` as Permission),
    ),
  ],
  [ROLES.TV]: [
    ...([RESOURCES.CATALOG, RESOURCES.MONITORING, RESOURCES.LICENSING] as Resource[]).flatMap(
      (r) => READ_ONLY.map((a) => `${r}:${a}` as Permission),
    ),
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccess(role: Role, resource: Resource, action: Action): boolean {
  return can(role, `${resource}:${action}`);
}

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
