import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/**
 * find-340abf0b / CODEBASE_MAP Gotcha #20 — o Painel Admin de assinaturas
 * precisa mostrar o modo real do Stripe (vindo de GET
 * /billing/admin/stripe-mode), no padrão ENV_BADGE. Falha do endpoint nunca
 * pode ser renderizada como se o Stripe estivesse em algum modo específico.
 */
const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock, setAccessToken: vi.fn(), setTenantId: vi.fn() }));

import AdminSubscriptions from "./AdminSubscriptions";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/admin/subscriptions"]}>
      <QueryClientProvider client={qc}>
        <AdminSubscriptions />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function mockStripeMode(result: Promise<unknown>) {
  apiMock.get.mockImplementation((path: string) => {
    if (path === "/billing/admin/stripe-mode") return result;
    return Promise.resolve([]);
  });
}

describe("AdminSubscriptions — indicador de modo Stripe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sandbox => badge TEST MODE", async () => {
    mockStripeMode(Promise.resolve({ environment: "sandbox", keyState: "VALID_TEST_KEY" }));
    renderPage();
    const badge = await screen.findByTestId("stripe-mode-badge");
    expect(badge).toHaveTextContent(/TEST MODE/);
    expect(badge).toHaveAttribute("data-environment", "sandbox");
  });

  it("disabled => badge 'desativado', nunca TEST MODE", async () => {
    mockStripeMode(Promise.resolve({ environment: "disabled", keyState: "LIVE_KEY_REJECTED" }));
    renderPage();
    const badge = await screen.findByTestId("stripe-mode-badge");
    expect(badge).toHaveTextContent(/desativado/);
    expect(badge).not.toHaveTextContent(/TEST MODE/);
  });

  it("erro do endpoint => estado de erro explícito, sem badge de modo", async () => {
    mockStripeMode(Promise.reject(new Error("Network error")));
    renderPage();
    expect(await screen.findByTestId("stripe-mode-badge-error")).toBeInTheDocument();
    expect(screen.queryByTestId("stripe-mode-badge")).toBeNull();
  });
});
