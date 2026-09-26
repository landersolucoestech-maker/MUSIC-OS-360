import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import liveAdminIntegrations from "../__fixtures__/admin-integrations.live.json";

/**
 * GATE C — caminho de RENDER real do Portal Admin.
 *
 * Este teste usa o COMPONENTE REAL montado pela rota /admin/configuracoes
 * (AdminSettings), seleciona a aba "Integrações" e prova que os registros
 * administrativos chegam ao DOM.
 *
 * A fixture NÃO é artificial: é a resposta literal capturada de
 * GET /api/v1/admin/integrations no runtime local (somente comerciais), salva em
 * __fixtures__/admin-integrations.live.json. Se o contrato da API mudar, este
 * teste passa a divergir do runtime — que é exatamente o sinal desejado.
 *
 * Regressão coberta: a aba aparecia vazia enquanto o banco tinha 14 registros.
 */

const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({
  api: apiMock,
  setAccessToken: vi.fn(),
  setTenantId: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import AdminSettings from "./AdminSettings";

const CATEGORIES = [
  { id: "c-signing", slug: "signing", name: "Assinatura Digital", display_order: 10, active: true },
  { id: "c-rights", slug: "rights", name: "Direitos Autorais", display_order: 20, active: true },
];

function renderAdminSettings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/admin/configuracoes"]}>
      <QueryClientProvider client={qc}>
        <AdminSettings />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function openIntegracoesTab() {
  const tab = await screen.findByText("Integrações");
  fireEvent.click(tab);
}

describe("Admin portal → Settings → Integrations (real component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.get.mockImplementation((path: string) => {
      if (path === "/admin/integrations") return Promise.resolve(liveAdminIntegrations);
      if (path === "/admin/integrations/categories") return Promise.resolve(CATEGORIES);
      return Promise.resolve([]);
    });
  });

  it("dispara a query administrativa ao montar a aba", async () => {
    renderAdminSettings();
    await openIntegracoesTab();
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith("/admin/integrations"));
  });

  it("renderiza os provedores administrativos no DOM (inclusive ocultos do cliente)", async () => {
    renderAdminSettings();
    await openIntegracoesTab();

    // Provedores COMERCIAIS exigidos no gate.
    for (const name of ["Autentique", "DocuSign", "Clicksign", "UBC"]) {
      expect(await screen.findByText(name), ).toBeInTheDocument();
    }
    // Reclassificação 2026-08-24: internos/billing saíram do catálogo comercial.
    for (const internal of ["Soundcharts", "ACRCloud", "Resend", "Stripe"]) {
      expect(screen.queryByText(internal), ).toBeNull();
    }
  });

  it("shows ALL commercial admin records, not only the available ones", async () => {
    renderAdminSettings();
    await openIntegracoesTab();

    await waitFor(() => expect(screen.getByTestId("admin-integration-autentique")).toBeInTheDocument());
    const rendered = document.querySelectorAll('[data-testid^="admin-integration-"]');
    expect(rendered.length).toBe(liveAdminIntegrations.length);
    expect(rendered.length).toBeGreaterThanOrEqual(14);
  });

  it("coming_soon and not_implemented stay visible and governable for the SYSTEM ADMIN", async () => {
    renderAdminSettings();
    await openIntegracoesTab();

    // clicksign: draft + sem adapter — invisível para o tenant, visível aqui.
    const row = await screen.findByTestId("admin-integration-clicksign");
    expect(within(row).getByText("Sem adapter")).toBeInTheDocument();
    // E continua editável: o select de publicação reflete o estado real.
    expect((screen.getByTestId("publication-clicksign") as HTMLSelectElement).value).toBe("coming_soon");
    // Audiências governáveis presentes.
    expect(screen.getByTestId("view-audience-clicksign")).toBeInTheDocument();
    expect(screen.getByTestId("use-audience-clicksign")).toBeInTheDocument();
  });

  it("usa nomes humanos, nunca o slug cru", async () => {
    renderAdminSettings();
    await openIntegracoesTab();

    expect(await screen.findByText("Google Ads")).toBeInTheDocument();
    // O slug aparece só como identificador técnico secundário, não como título.
    const row = screen.getByTestId("admin-integration-google_ads");
    const heading = within(row).getByText("Google Ads");
    expect(heading.tagName.toLowerCase()).not.toBe("code");
  });

  it("ERROR is not rendered as EMPTY (blocker regression)", async () => {
    apiMock.get.mockImplementation((path: string) => {
      if (path === "/admin/integrations") {
        return Promise.reject(Object.assign(new Error("Not Found"), { statusCode: 404 }));
      }
      return Promise.resolve(CATEGORIES);
    });

    renderAdminSettings();
    await openIntegracoesTab();

    // useAdminIntegrations usa retry: 1, então o estado de erro só assenta após
    // a segunda tentativa — daí o timeout maior (não é lentidão do componente).
    expect(await screen.findByTestId("admin-integrations-error", {}, { timeout: 5000 }))
      .toBeInTheDocument();
    expect(screen.queryByTestId("admin-integrations-empty")).not.toBeInTheDocument();
    expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
  });

  it("a real EMPTY (200 with an empty list) is distinct from ERROR", async () => {
    apiMock.get.mockImplementation((path: string) => {
      if (path === "/admin/integrations") return Promise.resolve([]);
      return Promise.resolve(CATEGORIES);
    });

    renderAdminSettings();
    await openIntegracoesTab();

    expect(await screen.findByTestId("admin-integrations-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-integrations-error")).not.toBeInTheDocument();
  });
});
