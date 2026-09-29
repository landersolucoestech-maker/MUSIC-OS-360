import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";

/**
 * N9: nothing is editable or savable until the tenant's settings load — no
 * client-side defaults (they were branded "Lander Records" and a save on a
 * failed load overwrote the tenant's configuration without the concurrency
 * check). N8: supervisor/manager are picked from the team, never typed ids.
 */
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => <div>{actions}{children}</div>,
}));
vi.mock("@/app/providers/TenantContext", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/shared/hooks/useSkillRun", () => ({
  useSkillRun: () => ({ result: null, isRunning: false, error: null, run: vi.fn() }),
}));
vi.mock("@/modules/musicchat/hooks/useMusicChatTriageRules", () => ({
  useMusicChatTriageRules: () => ({ runEscalations: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock("@/modules/musicchat/hooks/useMusicChatTeamMembers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/musicchat/hooks/useMusicChatTeamMembers")>();
  return {
    ...actual,
    useMusicChatTeamMembers: () => ({
      members: [{ auth_user_id: "auth-sup", full_name: "Joana Supervisora", email: "joana@example.com" }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useMusicChatMemberNames: (ids: Array<string | null | undefined>) => {
      const names = new Map(ids.includes("auth-sup") ? [["auth-sup", "Joana Supervisora"]] : []);
      return { names, isLoading: false, nameOf: (id: string | null | undefined, fallback: string) => (id ? names.get(id) ?? fallback : fallback) };
    },
  };
});

const mutate = vi.fn();
const refetch = vi.fn();
const hookState: Record<string, unknown> = {};
vi.mock("@/modules/musicchat/hooks/useMusicChatAutomationSettings", () => ({
  useMusicChatAutomationSettings: () => hookState,
}));

import MusicChatAutomationSettings from "@/modules/musicchat/pages/MusicChatAutomationSettings";

const TENANT_SETTINGS = {
  id: "s1", tenant_id: "t1", enabled: true,
  welcome_message: "Bem-vindo à Gravadora Exemplo",
  main_menu_message: "1. Shows",
  menu_options: [{ id: "shows", order: 1, label: "Shows", responseTemplateId: "shows", queue: "Comercial", sector: "Shows", defaultAssignee: null, tags: [], priority: "high", active: true }],
  templates: [{ id: "shows", title: "Shows", body: "Ok" }],
  required_fields: [], optional_fields: [],
  invalid_option_message: "Opção inválida", absence_message: "Ausente", out_of_hours_message: "Fora do horário", closing_message: "Tchau",
  return_to_menu_rule: { enabled: true, commands: ["menu"] },
  escalation_rules: [], notification_channels: { in_app: true },
  supervisor_user_id: "auth-sup", manager_user_id: "removed-member",
  created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-20T12:00:00.000Z",
};

const openTab = async (name: RegExp) => {
  await act(async () => {
    const tab = screen.getByRole("tab", { name });
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
  });
};

describe("<MusicChatAutomationSettings />", () => {
  beforeEach(() => {
    mutate.mockClear();
    refetch.mockClear();
    Object.assign(hookState, {
      settings: undefined, isLoading: false, isError: false, error: null, refetch,
      updateSettings: { mutate, isPending: false },
    });
  });

  it("while loading: a loading state, nothing editable, no save", () => {
    hookState.isLoading = true;
    renderWithProviders(<MusicChatAutomationSettings />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando configurações");
    expect(screen.queryByRole("button", { name: /Salvar configuração/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Lander Records/)).not.toBeInTheDocument();
  });

  it("after a failed load: an error with retry, no editable defaults and no save", () => {
    Object.assign(hookState, { isError: true, error: new Error("boom") });
    renderWithProviders(<MusicChatAutomationSettings />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar as configurações do MusicChat");
    fireEvent.click(within(alert).getByRole("button", { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Salvar configuração/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Lander Records/)).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("once loaded: edits the tenant's own values and saves them with the concurrency token", () => {
    hookState.settings = TENANT_SETTINGS;
    renderWithProviders(<MusicChatAutomationSettings />);
    expect(screen.getByDisplayValue("Bem-vindo à Gravadora Exemplo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Salvar configuração/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      welcome_message: "Bem-vindo à Gravadora Exemplo",
      required_fields: [],
      supervisor_user_id: "auth-sup",
      expectedUpdatedAt: TENANT_SETTINGS.updated_at,
    }));
  });

  it("supervisor and manager are member pickers showing names, never raw ids; a stale id is flagged", async () => {
    hookState.settings = TENANT_SETTINGS;
    renderWithProviders(<MusicChatAutomationSettings />);
    await openTab(/Escalonamento/);
    expect(screen.queryByPlaceholderText(/ID do usuário/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Supervisor padrão" })).toHaveTextContent("Joana Supervisora");
    expect(screen.getByRole("combobox", { name: "Gestor padrão" })).toHaveTextContent("Usuário não encontrado na equipe");
    expect(screen.queryByText("auth-sup")).not.toBeInTheDocument();
    expect(screen.queryByText("removed-member")).not.toBeInTheDocument();
  });
});
