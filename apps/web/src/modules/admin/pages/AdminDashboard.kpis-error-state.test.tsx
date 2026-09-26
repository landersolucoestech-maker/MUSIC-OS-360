import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/**
 * Regression (audit F3): when GET /billing/admin/tenants or
 * GET /billing/admin/subscriptions fails, the Executive Panel KPIs
 * (MRR, ARR, active customers, etc.) silently fell back to `[] ?? []`
 * and rendered "R$ 0" / "0" as if it were a real platform value —
 * indistinguishable from a genuinely empty platform. It also proves that the
 * permanent, outdated "Admin analytics indisponível" banner (which
 * falsely claimed the administrative endpoints did not exist) left
 * the layout.
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
