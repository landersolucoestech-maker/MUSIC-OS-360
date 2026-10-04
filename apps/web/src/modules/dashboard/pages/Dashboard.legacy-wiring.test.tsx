import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "@/test/_helpers/render-with-providers";

/**
 * Legacy wiring of the Dashboard presentation helpers:
 *  - describeAuditRow / auditEntityMeta / describeAuditAction: audit rows persisted with legacy plural / PT-BR entity
 *    keys (REST history + the `audit.entry.created` WS push) must render the PT-BR description and badge;
 *  - getBackendEventTypeLabel: the coarse events.type enum renders its PT-BR label on the agenda card.
 */
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/modules/artist/components/ArtistVision360Modal", () => ({ ArtistVision360Modal: () => null }));

const wsHandlers = new Map<string, (data: unknown) => void>();
vi.mock("@/shared/hooks/useWsEvent", () => ({
  useWsEvent: (event: string, handler: (data: unknown) => void) => { wsHandlers.set(event, handler); },
}));

const historyState: { data: unknown[] } = { data: [] };
vi.mock("@/modules/dashboard/hooks/useActivityHistory", () => ({ useActivityHistory: () => historyState }));
vi.mock("@/modules/artist/hooks/useArtists", () => ({ useArtists: () => ({ artists: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/modules/releases/hooks/useReleases", () => ({ useReleases: () => ({ releases: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/modules/projects/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/modules/dashboard/hooks/useOperationalDashboard", () => ({
  useOperationalDashboard: () => ({
    dashboard: { artists: 3, artists_by_status: {}, active_contracts_count: 0, contracts_expiring_soon_count: 0, revenue_current_month: 0 },
    isLoading: false, error: null, refetch: vi.fn(),
  }),
}));
const eventsState: { dashboardEvents: unknown; isLoading: boolean; error: Error | null; refetch: () => void } = {
  dashboardEvents: null, isLoading: false, error: null, refetch: vi.fn(),
};
vi.mock("@/modules/dashboard/hooks/useDashboardEvents", () => ({ useDashboardEvents: () => eventsState }));

import Dashboard from "@/modules/dashboard/pages/Dashboard";

const renderDashboard = () => renderWithProviders(<MemoryRouter><Dashboard /></MemoryRouter>);
const NOW = new Date().toISOString();
const activityItems = () => screen.getAllByTestId(/^activity-item-/);
const itemWithText = (text: string) => {
  const found = activityItems().find((el) => within(el).queryByText(text));
  if (!found) throw new Error(`no activity item with "${text}"`);
  return found;
};

describe("<Dashboard /> legacy wiring: audit activity feed", () => {
  beforeEach(() => {
    wsHandlers.clear();
    historyState.data = [];
    eventsState.dashboardEvents = null;
  });

  it("REST history: rows with legacy plural / PT-BR entity keys render PT-BR label, badge and name", () => {
    historyState.data = [
      { id: "h1", action: "created", entity: "artistas", after: { "nome_artistico": "Ana Lima" }, created_at: NOW },
      { id: "h2", action: "updated", entity: "obras", after: { title: "Noite" }, created_at: NOW },
      { id: "h3", action: "deleted", entity: "contratos", after: null, created_at: NOW },
    ];
    renderDashboard();

    const artist = itemWithText("Artista criado");
    expect(within(artist).getByText("Artista")).toBeInTheDocument();
    expect(within(artist).getByText("Ana Lima")).toBeInTheDocument();

    const work = itemWithText("Obra atualizada");
    expect(within(work).getByText("Obra")).toBeInTheDocument();
    expect(within(work).getByText("Noite")).toBeInTheDocument();

    const contract = itemWithText("Contrato removido");
    // badge + description (falls back to the entity noun)
    expect(within(contract).getAllByText("Contrato")).toHaveLength(2);
  });

  it("REST history: an unknown entity never leaks the raw key / action; it falls back to generic PT-BR copy", () => {
    historyState.data = [{ id: "h9", action: "zzz_raw.created", entity: "zzz_raw", after: null, created_at: NOW }];
    renderDashboard();
    const item = activityItems()[0];
    expect(item).toHaveTextContent("Registro criado");
    expect(within(item).getByText("Sistema")).toBeInTheDocument();
    expect(within(item).getByText("Detalhes não informados")).toBeInTheDocument();
    expect(item.textContent).not.toMatch(/zzz_raw/);
  });

  it("WS audit.entry.created: a legacy entity key gives the PT-BR headline and the entity badge", () => {
    renderDashboard();
    const handler = wsHandlers.get("audit.entry.created");
    expect(handler).toBeDefined();
    act(() => handler!({ action: "updated", entity: "obras" }));
    const item = itemWithText("Obra atualizada");
    expect(within(item).getByText("Obra")).toBeInTheDocument();
    expect(within(item).getByText("Registro de auditoria")).toBeInTheDocument();
  });

  it("WS audit.entry.created: without an entity the legacy plural action prefix names the entity (badge + headline)", () => {
    renderDashboard();
    act(() => wsHandlers.get("audit.entry.created")!({ action: "contratos.updated" }));
    const item = itemWithText("Contrato atualizado");
    expect(within(item).getByText("Contrato")).toBeInTheDocument();
    expect(item.textContent).not.toMatch(/contratos\.updated/);
  });

  it("WS audit.entry.created: an unknown entity falls back to the Sistema badge and generic headline", () => {
    renderDashboard();
    act(() => wsHandlers.get("audit.entry.created")!({ action: "zzz_raw.exploded", entity: "zzz_raw" }));
    const item = itemWithText("Registro atualizado");
    expect(within(item).getByText("Sistema")).toBeInTheDocument();
    expect(item.textContent).not.toMatch(/zzz_raw|exploded/);
  });
});

describe("<Dashboard /> legacy wiring: agenda card event type label", () => {
  beforeEach(() => { wsHandlers.clear(); historyState.data = []; });

  const withEvents = (upcoming: unknown[]) => {
    eventsState.dashboardEvents = { monthCount: upcoming.length, upcomingIncomplete: false, upcoming };
  };

  it.each([
    ["recording", "Gravação/Estúdio"],
    ["interview", "Entrevista/Imprensa"],
    ["tour", "Turnê"],
    ["show", "Show"],
  ])("events.type %p is shown as %p, never the raw enum", (type, label) => {
    withEvents([{ id: "e-1", title: "Evento X", type, status: "confirmed", starts_at: "2030-10-11T15:00:00.000Z" }]);
    renderDashboard();
    const item = screen.getByTestId("appointment-e-1");
    expect(within(item).getByText(label)).toBeInTheDocument();
    if (type !== "show") expect(item.textContent).not.toContain(type);
  });

  it("a missing / non-string type shows the generic PT-BR label instead of an empty badge", () => {
    withEvents([{ id: "e-2", title: "Sem tipo", type: null, status: "confirmed", starts_at: "2030-10-11T15:00:00.000Z" }]);
    renderDashboard();
    expect(within(screen.getByTestId("appointment-e-2")).getByText("Evento")).toBeInTheDocument();
  });
});
