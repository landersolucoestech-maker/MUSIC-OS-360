import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/**
 * CODEBASE_MAP Gotcha #19: "Several AdminSettings.tsx tabs are entirely
 * decorative (uncontrolled inputs, fake 'Configurações salvas' toast, no API
 * call)". This proves the Geral/Email/Segurança/Notificações tabs' Save
 * button no longer claims success it never delivers -- it's disabled and
 * fires no success toast, rather than lying about a persisted mutation.
 */
const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({
  api: apiMock,
  setAccessToken: vi.fn(),
  setTenantId: vi.fn(),
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import AdminSettings from "./AdminSettings";

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

describe("Admin portal → Settings → General (real component) — Save does not fake success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.get.mockResolvedValue([]);
  });

  it("the \"Salvar Alterações\" button is disabled (no backend contract exists)", async () => {
    renderAdminSettings();
    const button = await screen.findByTestId("button-save-settings");
    expect(button).toBeDisabled();
  });

  it("clicking the disabled button never fires toast.success or an API call", async () => {
    renderAdminSettings();
    const button = await screen.findByTestId("button-save-settings");
    fireEvent.click(button);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it("the section makes explicit that the tab does not persist changes yet", async () => {
    renderAdminSettings();
    expect(await screen.findByText(/ainda não persiste alterações/i)).toBeInTheDocument();
  });
});
