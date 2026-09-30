import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { ROLE_LABELS, useCurrentRole, useHasRole, useIsExactRole, type AppRole } from "@/shared/hooks/useHasRole";
import { useIsAdmin } from "@/shared/hooks/useIsAdmin";

let mockUser: { user_metadata?: Record<string, unknown> } | null = null;
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
