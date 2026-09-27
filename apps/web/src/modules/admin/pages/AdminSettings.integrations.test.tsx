import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import liveAdminIntegrations from "../__fixtures__/admin-integrations.live.json";

/**
 * GATE C — the Admin Portal's real RENDER path.
 *
 * This test uses the REAL COMPONENT mounted by the /admin/settings route
 * (AdminSettings), selects the "Integrações" tab and proves the administrative
 * records reach the DOM.
 *
 * The fixture is NOT artificial: it is the literal response captured from
 * GET /api/v1/admin/integrations at local runtime (commercial only), saved in
 * __fixtures__/admin-integrations.live.json. If the API contract changes, this
 * test starts diverging from the runtime — which is exactly the desired signal.
 *
 * Covered regression: the tab appeared empty while the database had 14 records.
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
    <MemoryRouter initialEntries={["/admin/settings"]}>
      <QueryClientProvider client={qc}>
        <AdminSettings />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function openIntegrationsTab() {
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

  it("fires the admin query when the tab mounts", async () => {
    renderAdminSettings();
    await openIntegrationsTab();
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith("/admin/integrations"));
  });

  it("renders the admin providers in the DOM (including those hidden from the customer)", async () => {
    renderAdminSettings();
    await openIntegrationsTab();

    // COMMERCIAL providers required by the gate.
    for (const name of ["Autentique", "DocuSign", "Clicksign", "UBC"]) {
      expect(await screen.findByText(name), ).toBeInTheDocument();
    }
    // 2026-08-24 reclassification: internal/billing ones left the commercial catalog.
    for (const internal of ["Soundcharts", "ACRCloud", "Resend", "Stripe"]) {
      expect(screen.queryByText(internal), ).toBeNull();
    }
  });

  it("shows ALL commercial admin records, not only the available ones", async () => {
    renderAdminSettings();
    await openIntegrationsTab();

    await waitFor(() => expect(screen.getByTestId("admin-integration-autentique")).toBeInTheDocument());
    const rendered = document.querySelectorAll('[data-testid^="admin-integration-"]');
    expect(rendered.length).toBe(liveAdminIntegrations.length);
    expect(rendered.length).toBeGreaterThanOrEqual(14);
  });

  it("coming_soon and not_implemented stay visible and governable for the SYSTEM ADMIN", async () => {
    renderAdminSettings();
    await openIntegrationsTab();

    // clicksign: draft + no adapter — invisible to the tenant, visible here.
    const row = await screen.findByTestId("admin-integration-clicksign");
    expect(within(row).getByText("Sem conector")).toBeInTheDocument();
    // And it stays editable: the publication select reflects the real state.
    expect((screen.getByTestId("publication-clicksign") as HTMLSelectElement).value).toBe("coming_soon");
    // Governable audiences present.
    expect(screen.getByTestId("view-audience-clicksign")).toBeInTheDocument();
    expect(screen.getByTestId("use-audience-clicksign")).toBeInTheDocument();
  });

  it("uses human-readable names, never the raw slug", async () => {
    renderAdminSettings();
    await openIntegrationsTab();

    expect(await screen.findByText("Google Ads")).toBeInTheDocument();
    // The slug appears only as a secondary technical identifier, not as the title.
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
    await openIntegrationsTab();

    // useAdminIntegrations uses retry: 1, so the error state only settles after
    // the second attempt — hence the larger timeout (it is not component slowness).
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
    await openIntegrationsTab();

    expect(await screen.findByTestId("admin-integrations-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-integrations-error")).not.toBeInTheDocument();
  });
});
