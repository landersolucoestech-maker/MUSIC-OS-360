import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ keys: [] as string[] | null }));

vi.mock("@/app/providers/TenantContext", () => ({ useTenant: () => ({ permissionKeys: state.keys }) }));
vi.mock("@/shared/lib/env", () => ({ AUTH_DISABLED: false, IS_DEV: false }));

import { usePermissions } from "./usePermissions";

describe("usePermissions hr/rh dual-read (production mode)", () => {
  it("legacy rh:* grants satisfy the canonical hr module and hr:* checks", () => {
    state.keys = ["rh:read", "rh:update"];
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canModule("hr", "read")).toBe(true);
    expect(result.current.canModule("hr", "write")).toBe(true);
    expect(result.current.canModule("hr", "delete")).toBe(false);
    expect(result.current.hasPermission("hr:read")).toBe(true);
  });

  it("canonical hr:* grants work and do not widen", () => {
    state.keys = ["hr:read"];
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasPermission("rh:read")).toBe(true);
    expect(result.current.hasPermission("rh:update")).toBe(false);
    expect(result.current.canModule("hr", "write")).toBe(false);
  });

  it("missing permissions still deny", () => {
    state.keys = null;
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canModule("hr", "read")).toBe(false);
    expect(result.current.isLoadingPermissions).toBe(true);
  });
});
