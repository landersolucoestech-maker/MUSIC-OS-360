import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";

/**
 * N6: a transfer picks a real team member and goes through PATCH
 * /conversations/:id/transfer (assignment, audit trail, realtime event) —
 * never the old hardcoded names written to metadata.assignee_name.
 * N7: assignees and message authors are shown by name, never by raw id.
 */
vi.mock("@/app/providers/TenantContext", () => ({ useTenant: () => ({ tenant: { id: "t1" }, canWrite: () => true }) }));
vi.mock("@/modules/leads/hooks", () => ({ useLeads: () => ({ createLead: vi.fn() }) }));
vi.mock("@/modules/crm-relationships/hooks/useContacts", () => ({ useContacts: () => ({ createContact: vi.fn() }) }));
vi.mock("@/modules/leads/modals/LeadFormModal", () => ({ LeadFormModal: () => null }));
vi.mock("@/modules/crm-relationships/modals/ContactFormModal", () => ({ ContactFormModal: () => null }));
vi.mock("@/modules/events/components/SchedulerFormModal", () => ({ SchedulerFormModal: () => null }));
vi.mock("@/modules/musicchat/hooks/useMusicChatAutomationSettings", () => ({ useMusicChatAutomationSettings: () => ({ settings: undefined }) }));
vi.mock("@/modules/musicchat/hooks/useMusicChatTriageRules", () => ({ useMusicChatTriageRules: () => ({ runEscalations: { mutate: vi.fn() } }) }));
vi.mock("@/shared/hooks/useUploadToR2", () => ({ useUploadToR2: () => ({ upload: vi.fn(), isUploading: false }) }));
vi.mock("@/shared/hooks/useWsEvent", () => ({ useWsEvent: () => undefined }));

const MEMBERS = [
  { auth_user_id: "auth-ana", full_name: "Ana Real", email: "ana@example.com" },
  { auth_user_id: "auth-bruno", full_name: null, email: "bruno@example.com" },
];
vi.mock("@/modules/musicchat/hooks/useMusicChatTeamMembers", () => ({
  UNASSIGNED_LABEL: "Sem responsável",
  UNKNOWN_MEMBER_LABEL: "Agente",
  memberDisplayName: (m: { full_name: string | null; email: string | null }) => m.full_name?.trim() || m.email || "Agente",
  // Server-side search, as the API does it (name or e-mail).
  useMusicChatTeamMembers: (search = "") => ({
    members: MEMBERS.filter((m) => `${m.full_name ?? ""} ${m.email}`.toLowerCase().includes(search.trim().toLowerCase())),
    isLoading: false,
    isSearching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMusicChatMemberNames: () => {
    const names = new Map([["auth-ana", "Ana Real"], ["auth-bruno", "bruno@example.com"]]);
    return { names, isLoading: false, nameOf: (id: string | null | undefined, fallback: string) => (id ? names.get(id) ?? fallback : fallback) };
  },
}));

const conversation = (assigneeId: string | null, updated_at = "2026-09-20T12:00:00.000Z") => ({
  id: "conv-1", customer: "Cliente X", handle: "5511999999999", phone: "5511999999999", instagram: "", email: "",
  originLabel: "WhatsApp", channel: "whatsapp", queue: "Comercial", sector: "Shows", status: "in_progress",
  assigneeId, protocol: "ABCD1234", sla: 100, remainingTimeLabel: "", deadlineState: "on_track", tags: [],
  lastMessage: "", lastMessageAt: "", createdAt: "", lastReplyAt: "", unread: 0, value: "",
  crmSummary: { existingCustomer: false, lead: "", openDeal: "", stage: "" }, auditTrail: [], updated_at,
});

const service = vi.hoisted(() => ({
  list: vi.fn(), messages: vi.fn(), get: vi.fn(), transfer: vi.fn(), update: vi.fn(),
}));
vi.mock("@/modules/musicchat/services/conversations.service", () => ({ musicChatConversationsService: service }));

import { SupportCenterView } from "@/modules/musicchat/components/SupportCenterView";

describe("<SupportCenterView /> team members", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.values(service).forEach((fn) => fn.mockReset());
    service.list.mockResolvedValue([conversation("auth-bruno")]);
    service.messages.mockResolvedValue([
      { id: "m1", sender: "agent", author: "Agente", authorId: "auth-ana", body: "Olá!", time: "10:00" },
      { id: "m2", sender: "agent", author: "Agente", authorId: "auth-gone", body: "Oi", time: "10:01" },
    ]);
    service.transfer.mockResolvedValue(conversation("auth-ana", "2026-09-20T12:05:00.000Z"));
  });

  it("shows the assignee and message authors by name, never by raw id", async () => {
    renderWithProviders(<SupportCenterView />);
    expect(await screen.findByText("Olá!")).toBeInTheDocument();
    expect(screen.getAllByText("bruno@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Ana Real")).toBeInTheDocument();
    expect(screen.getAllByText("Agente").length).toBeGreaterThan(0);
    for (const rawId of ["auth-ana", "auth-bruno", "auth-gone"]) {
      expect(screen.queryByText(rawId)).not.toBeInTheDocument();
    }
  });

  it("transfers to a real member through the transfer endpoint with the concurrency token", async () => {
    renderWithProviders(<SupportCenterView />);
    await screen.findByText("Olá!");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Transferir/ })[0]);
    });
    const combobox = await screen.findByRole("combobox", { name: "Responsável" });
    await act(async () => {
      fireEvent.pointerDown(combobox, { button: 0, ctrlKey: false, pointerType: "mouse" });
      fireEvent.click(combobox);
    });
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).queryByText("Lucas Araujo")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(listbox).getByText("Ana Real"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmar transferência/ }));
    });
    await waitFor(() => expect(service.transfer).toHaveBeenCalledWith("conv-1", {
      assigneeId: "auth-ana",
      serviceStatus: "in_progress",
      expectedUpdatedAt: "2026-09-20T12:00:00.000Z",
    }));
    expect(service.update).not.toHaveBeenCalled();
  });

  it("a new search clears the selected member, so a member the user no longer sees is never submitted", async () => {
    renderWithProviders(<SupportCenterView />);
    await screen.findByText("Olá!");
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Transferir/ })[0]);
    });
    const combobox = await screen.findByRole("combobox", { name: "Responsável" });
    await act(async () => {
      fireEvent.pointerDown(combobox, { button: 0, ctrlKey: false, pointerType: "mouse" });
      fireEvent.click(combobox);
    });
    await act(async () => {
      fireEvent.click(within(await screen.findByRole("listbox")).getByText("Ana Real"));
    });
    expect(screen.getByRole("button", { name: /Confirmar transferência/ })).toBeEnabled();
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Buscar por nome ou e-mail"), { target: { value: "bru" } });
    });
    expect(screen.getByRole("button", { name: /Confirmar transferência/ })).toBeDisabled();
    expect(service.transfer).not.toHaveBeenCalled();
  });
});
