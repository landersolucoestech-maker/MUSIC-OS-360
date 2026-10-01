import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { ROLE_LABELS, useCurrentRole, useHasRole, useIsExactRole, type AppRole } from "@/shared/hooks/useHasRole";
import { useIsAdmin } from "@/shared/hooks/useIsAdmin";

let mockUser: { role?: string; user_metadata?: Record<string, unknown> } | null = null;
vi.mock("@/app/providers/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

/**
 * RBAC expand step: an English alias must behave exactly like its canonical Portuguese role,
 * both as the CURRENT role and as the REQUIRED role. Portuguese roles keep working unchanged.
 */
const ALIAS_TO_CANONICAL: ReadonlyArray<readonly [alias: AppRole, canonical: AppRole]> = [
  ["legal", "juridico"],
  ["sales", "comercial"],
  ["producer", "produtor"],
  ["collaborator", "colaborador"],
  ["hr_manager", "rh_manager"],
  // canonical artist vs the legacy artista alias (S4a: artista is canonicalized to artist on write)
  ["artist", "artista"],
];

const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

function withRole(role: string | null) {
  mockUser = role === null ? null : { user_metadata: { role } };
}

function allowed(current: string | null, required: AppRole): boolean {
  withRole(current);
  return renderHook(() => useHasRole(required)).result.current;
}

describe("useHasRole (PT/EN role slug aliases)", () => {
  beforeEach(() => {
    mockUser = null;
  });

  it("keeps the Portuguese slugs in the union and the label table", () => {
    for (const legacy of ["juridico", "comercial", "produtor", "colaborador", "rh_manager", "artista"]) {
      expect(ALL_ROLES).toContain(legacy);
    }
  });

  it.each(ALIAS_TO_CANONICAL)("alias %s has the same label as %s", (alias, canonical) => {
    expect(ROLE_LABELS[alias]).toBe(ROLE_LABELS[canonical]);
  });

  it.each(ALIAS_TO_CANONICAL)("alias %s as CURRENT role: identical allow/deny to %s for every required role", (alias, canonical) => {
    for (const required of ALL_ROLES) {
      expect({ required, allowed: allowed(alias, required) }).toEqual({ required, allowed: allowed(canonical, required) });
    }
  });

  it.each(ALIAS_TO_CANONICAL)("alias %s as REQUIRED role: identical allow/deny to %s for every current role", (alias, canonical) => {
    for (const current of [...ALL_ROLES, "unknown_role", "radio"]) {
      expect({ current, allowed: allowed(current, alias) }).toEqual({ current, allowed: allowed(current, canonical) });
    }
  });

  it.each(ALIAS_TO_CANONICAL)("alias %s is not admin-level, like %s, and is denied when unauthenticated", (alias, canonical) => {
    // Not a super_admin/admin: cannot satisfy admin or tenant_owner requirements.
    expect(allowed(alias, "admin")).toBe(false);
    expect(allowed(alias, "tenant_owner")).toBe(false);
    expect(allowed(alias, "admin")).toBe(allowed(canonical, "admin"));
    // Every role satisfies viewer; an unauthenticated user satisfies nothing.
    expect(allowed(alias, "viewer")).toBe(true);
    expect(allowed(null, alias)).toBe(false);
  });

  it.each(ALIAS_TO_CANONICAL)("alias %s is not an admin (useIsAdmin) and useIsExactRole stays exact", (alias, canonical) => {
    withRole(alias);
    expect(renderHook(() => useIsAdmin()).result.current.isAdmin).toBe(false);
    expect(renderHook(() => useCurrentRole()).result.current).toBe(alias);
    expect(renderHook(() => useIsExactRole(alias)).result.current).toBe(true);
    expect(renderHook(() => useIsExactRole(canonical)).result.current).toBe(false);
  });

  it("unknown or missing current role is denied (deny by default)", () => {
    expect(allowed("not_a_role", "viewer")).toBe(false);
    expect(allowed(null, "viewer")).toBe(false);
    expect(allowed("super_admin", "viewer")).toBe(true);
  });
});

/**
 * RBAC S4a: the API now WRITES the canonical English slug. The hook must give every legacy slug and its
 * canonical slug the same result, deny what is unknown (including prototype keys) and never let a
 * canonical slug reach a level its legacy twin does not.
 */
describe("useHasRole (S4a canonical English slugs)", () => {
  beforeEach(() => {
    mockUser = null;
  });

  const PAIRS: ReadonlyArray<readonly [legacy: AppRole, canonical: AppRole]> = [
    ["juridico", "legal"],
    ["comercial", "sales"],
    ["produtor", "producer"],
    ["colaborador", "collaborator"],
    ["rh_manager", "hr_manager"],
    ["artista", "artist"],
  ];

  it.each(PAIRS)("%s and %s: identical allow/deny as current and as required role against every role", (legacy, canonical) => {
    for (const other of [...ALL_ROLES, "radio", "manager", "unknown_role"]) {
      expect(allowed(legacy, other as AppRole)).toBe(allowed(canonical, other as AppRole));
      expect(allowed(other, legacy)).toBe(allowed(other, canonical));
    }
  });

  it("the canonical artist is no longer below every role: it ranks like its legacy alias", () => {
    expect(allowed("artist", "viewer")).toBe(true);
    expect(allowed("artist", "artist")).toBe(true);
    expect(allowed("artist", "admin")).toBe(false);
    expect(allowed("artist", "legal")).toBe(false);
  });

  it.each(PAIRS)("%s/%s never satisfy admin, owner, tenant_owner or super_admin", (legacy, canonical) => {
    for (const role of [legacy, canonical]) {
      for (const higher of ["admin", "owner", "tenant_owner", "super_admin"] as AppRole[]) {
        expect(allowed(role, higher)).toBe(false);
      }
    }
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "LEGAL", "Legal", " legal", "juridico_", "", "admin_master", "ar_gestao", "leitor"])(
    "unknown or malformed current role %j is denied even for the lowest requirement",
    (role) => {
      expect(allowed(role, "viewer")).toBe(false);
    },
  );

  it.each(["constructor", "__proto__", "toString"])("prototype key %s as the REQUIRED role is not satisfiable by a low role", (required) => {
    expect(allowed("collaborator", required as AppRole)).toBe(false);
    expect(allowed("viewer", required as AppRole)).toBe(false);
  });

  it("every legacy slug keeps a label identical to its canonical slug (labels are the only Portuguese)", () => {
    for (const [legacy, canonical] of PAIRS) expect(ROLE_LABELS[legacy]).toBe(ROLE_LABELS[canonical]);
  });
});

describe("useCurrentRole prefers the server-set role (S1-1)", () => {
  it("uses user.role (mapped from app_metadata) over a user_metadata.role", () => {
    mockUser = { role: "viewer", user_metadata: { role: "super_admin" } };
    expect(renderHook(() => useCurrentRole()).result.current).toBe("viewer");
    expect(renderHook(() => useHasRole("admin")).result.current).toBe(false);
  });
});
