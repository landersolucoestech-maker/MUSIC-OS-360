import { beforeEach, describe, expect, it, vi } from "vitest";

const token = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("@/shared/lib/api-client", () => ({ getAccessToken: () => token.value }));

import { ROLE_PERMISSIONS, getPermissionsFromToken, isTenantRole } from "../tenant-labels";

const PROTOTYPE_KEYS = ["constructor", "__proto__", "toString", "hasOwnProperty"];
const jwtWithRole = (role: unknown) => `h.${btoa(JSON.stringify({ role }))}.s`;

beforeEach(() => {
  token.value = null;
});

describe("tenant role lookups are own-property only", () => {
  it.each(PROTOTYPE_KEYS)("isTenantRole(%s) is false", (key) => {
    expect(isTenantRole(key)).toBe(false);
  });
  it("accepts real roles only", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS)) expect(isTenantRole(role)).toBe(true);
    expect(isTenantRole(undefined)).toBe(false);
  });
  it.each(PROTOTYPE_KEYS)("a JWT with role %s gets the viewer permissions", (key) => {
    token.value = jwtWithRole(key);
    expect(getPermissionsFromToken()).toBe(ROLE_PERMISSIONS.viewer);
  });
  it("a JWT with a real role keeps its permissions", () => {
    token.value = jwtWithRole("admin");
    expect(getPermissionsFromToken()).toBe(ROLE_PERMISSIONS.admin);
  });
});
