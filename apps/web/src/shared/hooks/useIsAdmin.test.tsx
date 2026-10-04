import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIsAdmin } from "@/shared/hooks/useIsAdmin";

let mockUser: { role?: string; user_metadata?: Record<string, unknown> } | null = null;
vi.mock("@/app/providers/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

const isAdminFor = (role: string | null) => {
  mockUser = role === null ? null : { user_metadata: { role } };
  return renderHook(() => useIsAdmin()).result.current;
};

describe("useIsAdmin (role resolved through useCurrentRole)", () => {
  beforeEach(() => {
    mockUser = null;
  });

  it.each(["admin", "owner", "tenant_owner", "super_admin"])("%s is an admin and the role is exposed", (role) => {
    const result = isAdminFor(role);
    expect(result.isAdmin).toBe(true);
    expect(result.role).toBe(role);
  });

  it.each(["viewer", "manager", "artist", "artista", "colaborador", "rh_manager", "not_a_role"])("%s is not an admin", (role) => {
    const result = isAdminFor(role);
    expect(result.isAdmin).toBe(false);
    expect(result.role).toBe(role);
  });

  it("no user means no role and no admin (deny by default)", () => {
    const result = isAdminFor(null);
    expect(result.isAdmin).toBe(false);
    expect(result.role).toBeNull();
  });

  it("the role of the top-level user field wins over user_metadata", () => {
    mockUser = { role: "viewer", user_metadata: { role: "admin" } };
    const result = renderHook(() => useIsAdmin()).result.current;
    expect(result.isAdmin).toBe(false);
    expect(result.role).toBe("viewer");
  });
});
