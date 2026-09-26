import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IntegrationError } from "@/shared/lib/errors";

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

beforeEach(() => {
  state.session = { access_token: "token-abc" };
  state.getContext.mockReset();
});

describe("TenantProvider — /auth/context error surface (Part 76)", () => {
  it("sucesso: contextLoading termina em false e contextError permanece null", async () => {
    state.getContext.mockResolvedValue({
      user: { id: "u1", email: "owner@lander.example", fullName: "Owner", avatarUrl: null },
      workspace: { id: "org-1", orgId: "org-1", name: "LANDER RECORDS", slug: "lander", active: true, plan: "enterprise", features: {}, settings: {} },
      membership: { id: "m1", authUserId: "u1", role: "owner", isActive: true, permissions: ["artist:read"], hierarchyLevel: 100 },
      claims: { orgId: "org-1", role: "owner", appMetadata: {} },
    });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => expect(result.current.contextLoading).toBe(false));
    expect(result.current.contextError).toBeNull();
    expect(result.current.tenant.name).toBe("LANDER RECORDS");
  });

  it("503 failure (dependency unavailable): contextError is set instead of hanging in a silent loading state", async () => {
    state.getContext.mockRejectedValue(new IntegrationError("api", "Tenant bootstrap database unavailable", { statusCode: 503 }));

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => expect(result.current.contextLoading).toBe(false));
    expect(result.current.contextError).toMatch(/indisponível/i);
    // Nunca expõe a mensagem crua do backend — mensagem sanitizada e genérica.
    expect(result.current.contextError).not.toMatch(/bootstrap/i);
  });

  it("generic failure (non-503): contextError is still set, never left in limbo", async () => {
    state.getContext.mockRejectedValue(new IntegrationError("api", "Internal error", { statusCode: 500 }));

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => expect(result.current.contextLoading).toBe(false));
    expect(result.current.contextError).toBeTruthy();
  });
});
