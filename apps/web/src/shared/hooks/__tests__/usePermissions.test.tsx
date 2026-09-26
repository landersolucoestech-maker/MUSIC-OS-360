import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Estado mutável compartilhado com os mocks (hoisted para o vi.mock poder referenciar).
const state = vi.hoisted(() => ({
  env: { AUTH_DISABLED: false, IS_DEV: false },
  permissionKeys: null as string[] | null,
}));

vi.mock("@/shared/lib/env", () => ({
  get AUTH_DISABLED() { return state.env.AUTH_DISABLED; },
  get IS_DEV() { return state.env.IS_DEV; },
}));

vi.mock("@/app/providers/TenantContext", () => ({
  useTenant: () => ({ permissionKeys: state.permissionKeys }),
}));

import { usePermissions } from "../usePermissions";

function setProd() { state.env = { AUTH_DISABLED: false, IS_DEV: false }; }
function setDev() { state.env = { AUTH_DISABLED: false, IS_DEV: true }; }
function setAuthDisabled() { state.env = { AUTH_DISABLED: true, IS_DEV: false }; }
function perms() { return renderHook(() => usePermissions()).result.current; }

beforeEach(() => { setProd(); state.permissionKeys = null; });

describe("usePermissions — production (no bypass)", () => {
  it("populated permissionKeys grants the right permission and blocks the missing one", () => {
    state.permissionKeys = ["artist:read"];
    const p = perms();
    expect(p.hasPermission("artist:read")).toBe(true);
    expect(p.hasPermission("artist:create")).toBe(false);
    expect(p.isLoadingPermissions).toBe(false);
  });

  it("permissionKeys vazio bloqueia tudo", () => {
    state.permissionKeys = [];
    const p = perms();
    expect(p.hasPermission("artist:read")).toBe(false);
    expect(p.canModule("artists", "read")).toBe(false);
    expect(p.isLoadingPermissions).toBe(false);
  });

  it("permissionKeys null in production BLOCKS and sets isLoadingPermissions", () => {
    state.permissionKeys = null;
    const p = perms();
    expect(p.hasPermission("artist:read")).toBe(false);
    expect(p.canModule("artists", "read")).toBe(false);
    expect(p.isLoadingPermissions).toBe(true);
  });

  it("can(resource, action) monta resource:action corretamente", () => {
    state.permissionKeys = ["release:approve"];
    const p = perms();
    expect(p.can("release", "approve")).toBe(true);
    expect(p.can("release", "update")).toBe(false);
  });

  it("canModule(module, action) usa permission-map (write→update/create), sem role", () => {
    state.permissionKeys = ["accounting:update"];
    const p = perms();
    expect(p.canModule("accounting", "write")).toBe(true); // write resolve para update/create
    expect(p.canModule("accounting", "read")).toBe(false);
  });

  it("hasAllPermissions / hasAnyPermission respeitam o conjunto", () => {
    state.permissionKeys = ["artist:read", "artist:update"];
    const p = perms();
    expect(p.hasAllPermissions(["artist:read", "artist:update"])).toBe(true);
    expect(p.hasAllPermissions(["artist:read", "artist:delete"])).toBe(false);
    expect(p.hasAnyPermission(["artist:delete", "artist:read"])).toBe(true);
    expect(p.hasAnyPermission(["artist:delete"])).toBe(false);
  });
});

describe("usePermissions — dev/auth-disabled (permissivo)", () => {
  it("IS_DEV + permissionKeys null → allows (does not block dev)", () => {
    setDev();
    state.permissionKeys = null;
    const p = perms();
    expect(p.hasPermission("artist:create")).toBe(true);
    expect(p.canModule("accounting", "delete")).toBe(true);
    expect(p.isLoadingPermissions).toBe(false);
  });

  it("AUTH_DISABLED + permissionKeys null → permite", () => {
    setAuthDisabled();
    state.permissionKeys = null;
    const p = perms();
    expect(p.hasPermission("contracts:delete")).toBe(true);
    expect(p.isLoadingPermissions).toBe(false);
  });
});
