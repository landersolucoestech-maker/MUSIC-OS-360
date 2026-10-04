import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: { access_token: "token-abc" } as { access_token: string } | null,
  getContext: vi.fn(),
}));

vi.mock("@/shared/lib/env", () => ({
  AUTH_DISABLED: false,
  DEV_AUTH_BYPASS: false,
  IS_DEV: false,
}));

vi.mock("@/app/providers/AuthContext", () => ({
  useAuth: () => ({ session: state.session }),
}));

vi.mock("@/shared/lib/api-client", () => ({
  api: { get: (...args: unknown[]) => state.getContext(...args) },
  getAccessToken: () => state.session?.access_token ?? null,
}));

import { TenantProvider, useTenant } from "../TenantContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <TenantProvider>{children}</TenantProvider>;
}

function context(opts: { features?: Record<string, unknown>; permissions?: unknown }) {
  return {
    user: { id: "u1", email: "o@lander.example", fullName: "Owner", avatarUrl: null },
    workspace: { id: "org-1", orgId: "org-1", name: "LANDER", slug: "lander", active: true, plan: "enterprise", features: opts.features ?? {}, settings: {} },
    membership: { id: "m1", authUserId: "u1", role: "viewer", isActive: true, permissions: opts.permissions ?? [], hierarchyLevel: 10 },
    claims: { orgId: "org-1", role: "viewer", appMetadata: {} },
  };
}

async function load(opts: { features?: Record<string, unknown>; permissions?: unknown }) {
  state.getContext.mockResolvedValue(context(opts));
  const hook = renderHook(() => useTenant(), { wrapper });
  await waitFor(() => expect(hook.result.current.contextLoading).toBe(false));
  return hook;
}

beforeEach(() => {
  state.session = { access_token: "token-abc" };
  state.getContext.mockReset();
});

describe("TenantProvider legacy feature keys (normalizeFeatures dual-read)", () => {
  it("a tenant row not yet backfilled with moduleRh:false disables moduleHr (default is enabled)", async () => {
    const { result } = await load({ features: { moduleRh: false } });
    expect(result.current.isFeatureEnabled("moduleHr")).toBe(false);
  });

  it("a tenant row with moduleRh:true keeps moduleHr enabled and the legacy key is not a flag", async () => {
    const { result } = await load({ features: { moduleRh: true } });
    expect(result.current.isFeatureEnabled("moduleHr")).toBe(true);
    expect(Object.keys(result.current.tenant.features)).not.toContain("moduleRh");
  });

  it("the canonical key wins when both spellings are present", async () => {
    const { result } = await load({ features: { moduleHr: true, moduleRh: false } });
    expect(result.current.isFeatureEnabled("moduleHr")).toBe(true);
  });

  it("other flags are untouched by the dual-read", async () => {
    const { result } = await load({ features: { moduleRh: false, moduleArtists: false } });
    expect(result.current.isFeatureEnabled("moduleArtists")).toBe(false);
    expect(result.current.isFeatureEnabled("moduleCatalog")).toBe(true);
  });
});

describe("TenantProvider permission checks (tenantModulePermissionKeys, fail-closed)", () => {
  it("a persisted legacy rh:read grant satisfies canRead('hr') but nothing else", async () => {
    const { result } = await load({ permissions: ["rh:read"] });
    expect(result.current.canRead("hr")).toBe(true);
    expect(result.current.hasPermission("hr", "read")).toBe(true);
    expect(result.current.canWrite("hr")).toBe(false);
    expect(result.current.canDelete("hr")).toBe(false);
    expect(result.current.canRead("artists")).toBe(false);
  });

  it("the canonical hr:read grant satisfies canRead('hr') too", async () => {
    const { result } = await load({ permissions: ["hr:read"] });
    expect(result.current.canRead("hr")).toBe(true);
    expect(result.current.canRead("rh" as never)).toBe(true);
  });

  it("write/delete/export map to their backend actions (any equivalent spelling satisfies)", async () => {
    const { result } = await load({ permissions: ["rh:create", "hr:delete", "artist:export"] });
    expect(result.current.canWrite("hr")).toBe(true);
    expect(result.current.canDelete("hr")).toBe(true);
    expect(result.current.canExport("artists")).toBe(true);
    expect(result.current.canRead("hr")).toBe(false);
    expect(result.current.canExport("hr")).toBe(false);
  });

  it("an empty grant list denies every module/action (fail-closed)", async () => {
    const { result } = await load({ permissions: [] });
    for (const m of ["hr", "artists", "contracts"] as const) {
      expect(result.current.canRead(m)).toBe(false);
      expect(result.current.canWrite(m)).toBe(false);
    }
  });

  it("permissions not loaded (null) deny instead of opening", () => {
    state.session = null;
    const { result } = renderHook(() => useTenant(), { wrapper });
    expect(result.current.permissionKeys).toBeNull();
    expect(result.current.canRead("hr")).toBe(false);
    expect(result.current.canWrite("artists")).toBe(false);
  });
});
