// @ts-nocheck
// Settings page wiring of compat code: legacy localStorage keys (useUserSettings), a legacy NF-e provider
// session (useNfeStatus) and legacy member statuses (normalizeUserStatus) rendered through the real hooks.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const { usersRef } = vi.hoisted(() => ({ usersRef: { value: [] as unknown[] } }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("@/app/providers/AuthContext", () => {
  const value = { user: { id: "u1", email: "ana@example.com" }, updatePassword: vi.fn(async () => ({ error: null })) };
  return { useAuth: () => value };
});
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => ({ auth: { updateUser: vi.fn(async () => ({})) } }) }));
vi.mock("@/app/providers/TenantContext", () => {
  const value = {
    tenant: { name: "Org", plan: "pro", onboarding: { completed: true }, billing: { status: "active", seats: 5, seatsUsed: 2, currentPeriodEnd: null } },
    setTenant: vi.fn(),
  };
  return { useTenant: () => value };
});
vi.mock("@/shared/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { get: vi.fn(async () => []), post: vi.fn(async () => ({})), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/shared/hooks/useAiSkillRun", () => ({ useAiSkillRun: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("@/shared/components/ai/AiSkillRunPanel", () => ({ AiSkillRunPanel: () => null }));
vi.mock("@/shared/components/MainLayout", () => ({ MainLayout: ({ children }) => <div>{children}</div> }));
vi.mock("@/modules/settings/hooks/useCompanySettings", () => {
  const value = { companySettings: {}, isLoading: false, saving: false, setCompanySettings: vi.fn(), saveCompanySettings: vi.fn(async () => true) };
  return { useCompanySettings: () => value };
});
vi.mock("@/modules/settings/hooks/useUsers", () => ({ useUsers: () => ({ users: usersRef.value, isLoading: false }) }));
vi.mock("@/modules/settings/hooks/useRoles", () => {
  const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  const value = {
    roles: [{ id: "r1", slug: "member", name: "member" }],
    permissions: [],
    teamInvites: [],
    isLoading: false,
    inviteUser: mutation, cancelInvite: mutation, resendInvite: mutation, assignRoleToUser: mutation,
    assignPermissionToRole: mutation, removePermissionFromRole: mutation, createRole: mutation, updateRole: mutation,
    duplicateRole: mutation, archiveRole: mutation, restoreRole: mutation, addRoleInheritance: mutation, removeRoleInheritance: mutation,
    getPermissionsForRole: () => [], getPermissionsByCategory: () => ({}), getRoleDetail: vi.fn(),
    authorityMode: undefined, authorityModeLoading: false,
  };
  return { useRoles: () => value };
});
vi.mock("@/modules/settings/components/UserFormModal", () => ({ UserFormModal: () => null }));
vi.mock("@/modules/settings/components/UserViewModal", () => ({ UserViewModal: () => null }));
vi.mock("@/modules/settings/components/LogoUploader", () => ({ LogoUploader: () => null }));
vi.mock("@/modules/integrations/hooks/useMarketingOAuth", () => ({
  useMarketingOAuth: () => ({ isConnected: () => false, needsReauth: () => false, connect: vi.fn(), disconnect: vi.fn() }),
}));
vi.mock("@/modules/integrations/hooks/useExternalProviders", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useExternalProviders: () => ({ data: [] }) };
});
vi.mock("@/modules/integrations/hooks/useAbramus", () => ({ useAbramusStatus: () => ({ data: undefined }) }));
vi.mock("@/modules/integrations/hooks/useEcad", () => ({ useEcadStatus: () => ({ data: undefined }) }));
vi.mock("@/modules/integrations/hooks/useAutentique", () => ({ useAutentiqueStatus: () => ({ data: undefined }) }));
vi.mock("@/modules/integrations/hooks/useUbc", () => ({ useUbcStatus: () => ({ data: undefined }) }));
vi.mock("@/modules/integrations/components/MarketingOAuthDialog", () => ({ MarketingOAuthDialog: () => null }));
vi.mock("@/modules/integrations/components/AbramusConfigDialog", () => ({ AbramusConfigDialog: () => null }));
vi.mock("@/modules/integrations/components/EcadConfigDialog", () => ({ EcadConfigDialog: () => null }));
vi.mock("@/modules/integrations/components/AutentiqueConfigDialog", () => ({ AutentiqueConfigDialog: () => null }));
vi.mock("@/modules/integrations/components/UbcConfigDialog", () => ({ UbcConfigDialog: () => null }));
vi.mock("@/modules/integrations/components/NfeConfigDialog", () => ({ NfeConfigDialog: () => null }));
vi.mock("@/modules/settings/services/billing-plans.service", () => ({ billingPlansService: { listPlans: async () => [] } }));
vi.mock("@/modules/settings/services/billing-invoices.service", () => ({ billingInvoicesService: { listInvoices: async () => [] } }));

import SettingsPage from "@/modules/settings/pages/Settings";

const SETTINGS_KEY = "musicos360_user_settings:u1";
// legacy storage keys by canonical name (string-literal table)
const LEGACY_KEY: Record<string, string> = {
  auto_finance_alert: "auto_alerta_financeiro",
  auto_renewal_reminder: "auto_lembrete_renovacao",
  auto_notify_expiry: "auto_notificar_vencimento",
};
const NFE_KEY = "musicos360_nfe_credentials";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openTab(name: string) {
  const trigger = await screen.findByRole("tab", { name: new RegExp(name) });
  fireEvent.mouseDown(trigger, { button: 0 });
  fireEvent.click(trigger);
}

function member(id: string, status: string) {
  return { id, email: `${id}@example.com`, full_name: `Member ${id}`, phone: null, avatar_url: null, role: "member", status, created_at: "2026-01-02T00:00:00.000Z" };
}

describe("Settings page compat wiring", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); usersRef.value = []; });

  it("automation switches reflect settings stored under legacy Portuguese localStorage keys", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ [LEGACY_KEY.auto_finance_alert]: true, [LEGACY_KEY.auto_renewal_reminder]: false, [LEGACY_KEY.auto_notify_expiry]: false }));
    renderPage();
    await openTab("Automa");
    await waitFor(() => expect(document.querySelector('[data-state="checked"][role="switch"]')).not.toBeNull());
    const switchOf = (title: string) =>
      screen.getByText(title).parentElement!.parentElement!.querySelector('[role="switch"]') as HTMLElement;
    // legacy auto_alerta_financeiro:true is read as auto_finance_alert (default false);
    // the legacy false values of the other two override their default true
    expect(switchOf("Alerta de saldo baixo")).toHaveAttribute("aria-checked", "true");
    expect(switchOf("Sugestão automática de renovação")).toHaveAttribute("aria-checked", "false");
    expect(switchOf("Contrato próximo do vencimento")).toHaveAttribute("aria-checked", "false");
  });

  it("the NF-e card is connected for a session stored with the legacy provider 'proprio', not connected without a session", async () => {
    sessionStorage.setItem(NFE_KEY, JSON.stringify({ cnpj: "1", tax_regime: "lucro_real", environment: "sandbox", certificate_type: "A1", provider: "proprio", saved_at: "2026-01-01T00:00:00.000Z" }));
    renderPage();
    await openTab("Integra");
    const row = await screen.findByTestId("integration-row-nfe");
    await waitFor(() => expect(within(row).getByText("Conectado")).toBeInTheDocument());
    expect(within(row).queryByText("Não conectado")).toBeNull();
  });

  it("negative: without a stored NF-e session the NF-e card is not connected", async () => {
    renderPage();
    await openTab("Integra");
    const row = await screen.findByTestId("integration-row-nfe");
    expect(within(row).getByText("Não conectado")).toBeInTheDocument();
    expect(within(row).queryByText("Conectado")).toBeNull();
  });

  it("legacy member statuses are counted as active only when they map to active, and the row select shows the canonical label", async () => {
    usersRef.value = [member("a", "ativo"), member("b", "active"), member("c", "inativo"), member("d", "pendente"), member("e", "suspenso")];
    renderPage();
    await openTab("Usu");
    const counter = await screen.findByText("Usuários Ativos");
    expect(counter.nextElementSibling).toHaveTextContent("2");
    expect(screen.getByTestId("select-status-a")).toHaveTextContent("Ativo");
    expect(screen.getByTestId("select-status-b")).toHaveTextContent("Ativo");
    expect(screen.getByTestId("select-status-c")).toHaveTextContent("Inativo");
    expect(screen.getByTestId("select-status-d")).toHaveTextContent("Pendente");
  });
});
