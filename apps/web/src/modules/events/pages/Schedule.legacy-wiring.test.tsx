// @ts-nocheck
// Wiring test: the Schedule page takes the operational event types from useOperationalSettings and
// translates the type filter (canonical or pre-OL1 slug) into the coarse backend type configured on
// the operational item before querying.
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

const L = (...p: string[]) => p.join("");

const { scoped } = vi.hoisted(() => ({ scoped: { calls: [] as any[] } }));

const item = (slug: string, name: string, backendType: string) => ({
  id: `i-${slug}`, kind: "event_type", name, slug, description: "", active: true, order: 10, metadata: { backend_type: backendType },
});
const operational = vi.hoisted(() => ({ items: [] as any[] }));
operational.items = [
  { id: "a", kind: "event_type", name: "Sessões de estúdio", slug: "studio_sessions", description: "", active: true, order: 1, metadata: { backend_type: "tour" } },
  { id: "b", kind: "event_type", name: "Reuniões", slug: "meetings", description: "", active: true, order: 2, metadata: { backend_type: "interview" } },
];

const stable = vi.hoisted(() => ({
  getOptionsByKind: undefined as any,
  getItemsByKind: undefined as any,
}));
stable.getOptionsByKind = () => operational.items.map((i: any) => ({ value: i.slug, label: i.name }));
stable.getItemsByKind = () => operational.items;

vi.mock("@/modules/settings/hooks/useOperationalSettings", () => ({
  useOperationalSettings: () => ({ getOptionsByKind: stable.getOptionsByKind, getItemsByKind: stable.getItemsByKind }),
}));
vi.mock("@/modules/events/hooks/useEvents", () => ({
  useEvents: () => ({ events: [], isLoading: false, deleteEvent: { mutate: vi.fn() }, addEvent: { mutateAsync: vi.fn() } }),
}));
vi.mock("@/modules/events/hooks/useEventsScoped", () => ({
  useEventsScoped: (args: any) => {
    scoped.calls.push(args);
    return { events: [], isLoading: false, error: null, refetch: vi.fn() };
  },
  useEventsStats: () => ({ kpis: { total: 0, confirmed: 0, pending: 0, upcoming7Days: 0 } }),
}));
vi.mock("@/modules/events/hooks/useScheduleParticipants", () => {
  return {
    scheduleParticipantKey: (p: any) => `${p.source}:${p.id}`,
    normalizeScheduleParticipants: (v: any) => (Array.isArray(v) ? v : []),
    summarizeScheduleParticipants: (ps: any[]) => ps.map((p) => p.label).join(", "),
    useScheduleParticipants: () => ({ getArtistParticipantById: () => undefined }) };
});
vi.mock("@/modules/events/components/SchedulerFormModal", () => ({ SchedulerFormModal: () => null }));
vi.mock("@/modules/events/components/SchedulerViewModal", () => ({ SchedulerViewModal: () => null }));
vi.mock("@/shared/components/DeleteConfirmModal", () => ({ DeleteConfirmModal: () => null }));
vi.mock("@/shared/components/EntityCalendarView", () => ({ EntityCalendarView: () => null }));
vi.mock("@/shared/components/MainLayout", () => ({ MainLayout: ({ actions, children }: any) => <div>{actions}{children}</div> }));
vi.mock("@/shared/components/FeatureGate", () => ({ FeatureGate: ({ children }: any) => <>{children}</> }));
vi.mock("@/shared/components/RequirePermission", () => ({ RequirePermission: ({ children }: any) => <>{children}</> }));
vi.mock("@/shared/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

import Schedule from "@/modules/events/pages/Schedule";

// selects in toolbar order: view mode, type filter, status filter
const typeFilter = () => document.querySelectorAll("select")[1] as HTMLSelectElement;
const lastType = () => scoped.calls.at(-1).type;

beforeEach(() => {
  scoped.calls.length = 0;
  operational.items = [
    item("studio_sessions", "Sessões de estúdio", "tour"),
    item("meetings", "Reuniões", "interview"),
  ];
});

describe("Schedule page legacy wiring (type filter)", () => {
  it("renders the operational event types as filter options and starts unfiltered", () => {
    render(<Schedule />);
    const values = Array.from(typeFilter().options).map((o) => o.value);
    expect(values).toEqual(["all-type", "studio_sessions", "meetings"]);
    expect(lastType()).toBeUndefined();
  });

  it("a granular category is translated to the coarse type configured on its operational item", () => {
    render(<Schedule />);
    fireEvent.change(typeFilter(), { target: { value: "meetings" } });
    // configured meetings -> interview (the built-in table would say meeting; the raw slug is not a backend type)
    expect(lastType()).toBe("interview");
    fireEvent.change(typeFilter(), { target: { value: "studio_sessions" } });
    expect(lastType()).toBe("tour");
  });

  it("a stored pre-OL1 slug option resolves through the canonical item", () => {
    operational.items = [item("meetings", "Reuniões", "interview")];
    const legacy = L("reu", "nioes");
    stable.getOptionsByKind = () => [{ value: legacy, label: "Reuniões (legado)" }];
    render(<Schedule />);
    fireEvent.change(typeFilter(), { target: { value: legacy } });
    expect(lastType()).toBe("interview");
    stable.getOptionsByKind = () => operational.items.map((i: any) => ({ value: i.slug, label: i.name }));
  });

  it("negative: clearing the filter and an unconfigured slug never send a granular slug", () => {
    operational.items = [];
    render(<Schedule />);
    fireEvent.change(typeFilter(), { target: { value: "meetings" } });
    expect(lastType()).toBe("other");
    fireEvent.change(typeFilter(), { target: { value: "all-type" } });
    expect(lastType()).toBeUndefined();
  });
});
