import { describe, expect, it, vi } from "vitest";
import type { User as SupabaseUser } from "@supabase/supabase-js";
vi.mock("@/lib/supabase", () => ({ supabase: {}, getSupabaseClient: () => ({}) }));
import { mapSupabaseUser } from "../AuthContext";

const base = { id: "u1", email: "a@b.com" } as unknown as SupabaseUser;

describe("mapSupabaseUser role source (S1-1)", () => {
  it("never takes the role from the end-user-editable user_metadata", () => {
    const user = mapSupabaseUser({ ...base, user_metadata: { role: "super_admin" }, app_metadata: {} } as unknown as SupabaseUser);
    expect(user.role).toBeUndefined();
    expect(user.user_metadata?.role).toBeUndefined();
  });
  it("takes the role from app_metadata (user object or JWT claims)", () => {
    const fromUser = mapSupabaseUser({ ...base, user_metadata: { role: "super_admin" }, app_metadata: { role: "viewer" } } as unknown as SupabaseUser);
    expect(fromUser.role).toBe("viewer");
    expect(fromUser.user_metadata?.role).toBe("viewer");
    const fromJwt = mapSupabaseUser({ ...base, user_metadata: { role: "super_admin" } } as unknown as SupabaseUser, { role: "admin" });
    expect(fromJwt.role).toBe("admin");
  });
});
