import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/**
 * Regressão (auditoria F3): quando GET /billing/admin/tenants ou
 * GET /billing/admin/subscriptions falha, os KPIs do Painel Executivo
 * (MRR, ARR, Clientes Ativos, etc.) caíam silenciosamente para `[] ?? []`
 * e renderizavam "R$ 0" / "0" como se fosse um valor real da plataforma —
 * indistinguível de uma plataforma genuinamente vazia. Também prova que o
 * banner permanente e desatualizado "Admin analytics indisponível" (que
 * afirmava falsamente que os endpoints administrativos não existem) saiu
 * do layout.
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({
  api: apiMock,
  setAccessToken: vi.fn(),
  setTenantId: vi.fn(),
}));

import AdminDashboard from "./AdminDashboard";

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/admin/dashboard"]}>
      <QueryClientProvider client={qc}>
        <AdminDashboard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("AdminDashboard — falha de query nunca vira KPI zerado fabricado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("an endpoint that is down shows 'Indisponível', never a fabricated R$ 0", async () => {
    apiMock.get.mockImplementation((path: string) => {
      if (path === "/billing/admin/tenants") return Promise.reject(new Error("Network error"));
      if (path === "/billing/admin/subscriptions") return Promise.reject(new Error("Network error"));
      return Promise.resolve([]);
    });

    renderDashboard();

    const mrrCards = await screen.findAllByText("Indisponível");
    expect(mrrCards.length).toBeGreaterThan(0);
    expect(screen.queryByText("R$ 0")).toBeNull();
    expect(screen.queryByText(/R\$\s*0,00/)).toBeNull();
  });

  it("a healthy endpoint with a genuinely empty platform shows a real 0, not 'Indisponível'", async () => {
    apiMock.get.mockImplementation((path: string) => {
      if (path === "/billing/admin/tenants") return Promise.resolve([]);
      if (path === "/billing/admin/subscriptions") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderDashboard();

    expect(await screen.findByText("Painel Executivo")).toBeInTheDocument();
    expect(screen.queryByText("Indisponível")).toBeNull();
  });

  it("no longer renders the stale 'Admin analytics indisponível' banner", async () => {
    apiMock.get.mockImplementation(() => Promise.resolve([]));
    renderDashboard();
    await screen.findByText("Painel Executivo");
    expect(screen.queryByText("Admin analytics indisponível")).toBeNull();
  });
});
