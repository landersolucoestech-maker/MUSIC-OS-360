import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PasswordChangeRequiredError, IntegrationError } from "@/shared/lib/errors";

const state = vi.hoisted(() => ({
  session: { access_token: "token-abc" } as { access_token: string } | null,
  user: { mustChangePassword: false } as { mustChangePassword?: boolean } | null,
  tenant: { billing: { status: "active" as const, graceUntil: undefined, amountDue: undefined, invoiceUrl: undefined } },
  setTenant: vi.fn((updater: (prev: unknown) => unknown) => { state.tenant = updater(state.tenant) as typeof state.tenant; }),
  getSubscription: vi.fn(),
  captureError: vi.fn(),
}));

vi.mock("@/shared/lib/env", () => ({ AUTH_DISABLED: false }));
vi.mock("@/shared/lib/error-logger", () => ({ captureError: (...args: unknown[]) => state.captureError(...args) }));
vi.mock("@/app/providers/AuthContext", () => ({ useAuth: () => ({ session: state.session, user: state.user }) }));
vi.mock("@/app/providers/TenantContext", async () => {
  const actual = await vi.importActual<typeof import("@/app/providers/TenantContext")>("@/app/providers/TenantContext");
  return { ...actual, useTenant: () => ({ tenant: state.tenant, setTenant: state.setTenant }) };
});
vi.mock("@/shared/lib/api-client", () => ({
  api: { get: (...args: unknown[]) => state.getSubscription(...args) },
}));

import { BillingProvider, useBilling } from "../BillingContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <BillingProvider>{children}</BillingProvider>;
}

beforeEach(() => {
  state.session = { access_token: "token-abc" };
  state.user = { mustChangePassword: false };
  state.getSubscription.mockReset();
  state.captureError.mockReset();
  state.setTenant.mockClear();
});

describe("BillingProvider — error handling in refresh() (Part 77)", () => {
  it("PasswordChangeRequiredError (403) never escapes as an unhandled rejection and is not logged as an unexpected error", async () => {
    state.getSubscription.mockRejectedValue(new PasswordChangeRequiredError("Troca de senha obrigatória antes de continuar."));

    const { result } = renderHook(() => useBilling(), { wrapper });
    await waitFor(() => expect(state.getSubscription).toHaveBeenCalled());
    // Não deveria ter lançado — se chegou aqui sem o teste falhar, refresh() engoliu o erro.
    expect(result.current).toBeDefined();
    expect(state.captureError).not.toHaveBeenCalled();
  });

  it("an unexpected (5xx) error is captured via captureError but never propagates", async () => {
    state.getSubscription.mockRejectedValue(new IntegrationError("api", "boom", { statusCode: 500 }));

    renderHook(() => useBilling(), { wrapper });
    await waitFor(() => expect(state.getSubscription).toHaveBeenCalled());
    await waitFor(() => expect(state.captureError).toHaveBeenCalled());
  });

  it("when must_change_password=true, never calls /billing/subscription", async () => {
    state.user = { mustChangePassword: true };

    renderHook(() => useBilling(), { wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(state.getSubscription).not.toHaveBeenCalled();
  });
});
