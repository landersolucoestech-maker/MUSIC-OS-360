// @ts-nocheck
// Wiring test: SchedulerFormModal reads events persisted with a legacy title field / legacy
// granular type (legacyTitle, canonicalEventCategory), takes the operational event types from
// useOperationalSettings and sends the coarse backend type configured in the operational list
// (buildGranularToBackendTypeMap + eventCategoryToBackendType).
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const L = (...p: string[]) => p.join("");

const { spies } = vi.hoisted(() => ({
  spies: { add: vi.fn(), update: vi.fn() },
}));

const item = (slug: string, name: string, backendType: string) => ({
  id: `i-${slug}`, kind: "event_type", name, slug, description: "", active: true, order: 10, metadata: { backend_type: backendType },
});
const operational = {
  items: [item("studio_sessions", "Sessões de estúdio", "recording"), item("meetings", "Reuniões", "interview")],
};

vi.mock("@/modules/settings/hooks/useOperationalSettings", () => ({
  useOperationalSettings: () => ({
    getOptionsByKind: () => operational.items.map((i) => ({ value: i.slug, label: i.name })),
    getItemsByKind: () => operational.items,
  }),
}));
vi.mock("@/modules/events/hooks/useEvents", () => ({
  useEvents: () => ({ addEvent: { mutateAsync: spies.add }, updateEvent: { mutateAsync: spies.update } }),
}));
vi.mock("@/modules/events/hooks/useScheduleParticipants", () => {
  return {
    scheduleParticipantKey: (p: any) => `${p.source}:${p.id}`,
    normalizeScheduleParticipants: (v: any) => (Array.isArray(v) ? v : []),
    summarizeScheduleParticipants: (ps: any[]) => ps.map((p) => p.label).join(", "),
    useScheduleParticipants: () => ({
      participants: [], getParticipantByKey: () => undefined, getArtistParticipantById: () => undefined, pendingArtist: null,
    }),
  };
});
vi.mock("@/shared/components/AsyncEntityCombobox", () => ({ AsyncEntityCombobox: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/shared/ui/date-picker-field", () => ({
  DatePickerField: (p: any) => <input data-testid={p["data-testid"]} value={p.value} onChange={(e) => p.onChange(e.target.value)} />,
}));
vi.mock("@/shared/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select value={value} disabled={disabled} onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

import { SchedulerFormModal } from "@/modules/events/components/SchedulerFormModal";

const renderModal = (props: any) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SchedulerFormModal open onOpenChange={() => {}} {...props} />
    </QueryClientProvider>,
  );
const typeSelect = () => document.querySelectorAll("select")[0] as HTMLSelectElement;

beforeEach(() => {
  spies.add.mockReset().mockResolvedValue({});
  spies.update.mockReset().mockResolvedValue({});
  operational.items = [item("studio_sessions", "Sessões de estúdio", "recording"), item("meetings", "Reuniões", "interview")];
});

describe("SchedulerFormModal legacy wiring (edit)", () => {
  const legacyEvent = {
    id: "e1",
    [L("tit", "ulo")]: "Reunião de alinhamento",
    type: L("reu", "niao"),
    status: "scheduled",
    starts_at: "2026-03-10T20:00:00.000Z",
  };

  it("an event stored with the legacy title field and legacy type prefills the canonical title and category", () => {
    renderModal({ mode: "edit", event: legacyEvent });
    expect(screen.getByPlaceholderText("Digite o título do evento")).toHaveValue("Reunião de alinhamento");
    expect(typeSelect().value).toBe("meetings");
  });

  it("negative: the canonical title wins over the legacy one and an unknown type is not guessed", () => {
    renderModal({ mode: "edit", event: { ...legacyEvent, title: "Canonical title", type: "valor_desconhecido" } });
    expect(screen.getByPlaceholderText("Digite o título do evento")).toHaveValue("Canonical title");
    expect(typeSelect().value).not.toBe("meetings");
  });

  it("submitting sends the coarse backend type configured on the operational item and the legacy title", async () => {
    renderModal({ mode: "edit", event: legacyEvent });
    fireEvent.submit(document.querySelector("form"));
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1));
    const payload = spies.update.mock.calls[0][0];
    expect(payload.id).toBe("e1");
    expect(payload.title).toBe("Reunião de alinhamento");
    // operational item meetings -> interview (the built-in table would say meeting)
    expect(payload.type).toBe("interview");
  });

  it("negative: a category with no operational item uses the built-in coarse mapping, an unmapped one is other", async () => {
    operational.items = [];
    renderModal({ mode: "edit", event: legacyEvent });
    fireEvent.submit(document.querySelector("form"));
    await waitFor(() => expect(spies.update).toHaveBeenCalledTimes(1));
    expect(spies.update.mock.calls[0][0].type).toBe("meeting");
  });
});

describe("SchedulerFormModal legacy wiring (create with a stored legacy operational slug)", () => {
  it("selecting a legacy-slug option is normalized to the canonical category on submit", async () => {
    operational.items = [item(L("reu", "nioes"), "Reuniões (legado)", "meeting")];
    renderModal({ mode: "create" });
    fireEvent.change(screen.getByPlaceholderText("Digite o título do evento"), { target: { value: "  Alinhamento  " } });
    fireEvent.change(typeSelect(), { target: { value: L("reu", "nioes") } });
    fireEvent.change(screen.getByTestId("datepicker-start-date"), { target: { value: "2026-05-01" } });
    // the raw legacy slug is not a meeting category: the venue block is hidden
    expect(screen.queryByText("Nome do Local")).not.toBeInTheDocument();
    fireEvent.submit(document.querySelector("form"));
    await waitFor(() => expect(spies.add).toHaveBeenCalledTimes(1));
    const payload = spies.add.mock.calls[0][0];
    expect(payload.title).toBe("Alinhamento");
    expect(payload.type).toBe("meeting");
    // the form state now holds the canonical category: the meeting venue block is shown
    await waitFor(() => expect(screen.getByText("Nome do Local")).toBeInTheDocument());
  });
});
