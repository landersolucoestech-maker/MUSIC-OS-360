import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "./_helpers/render-with-providers";

/**
 * I1 / N4 / N5 — Dashboard-level coverage of the events KPI and the upcoming
 * appointments: they come from the starts_at-scoped useDashboardEvents
 * (not the 50 oldest events), render starts_at in the system timezone, and a
 * failed events query is shown as unavailable instead of "0" / "no appointments".
 */
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/Sao_Paulo"; });
afterAll(() => { process.env.TZ = ORIGINAL_TZ; });

vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/modules/artist/components/ArtistVision360Modal", () => ({ ArtistVision360Modal: () => null }));
vi.mock("@/shared/hooks/useWsEvent", () => ({ useWsEvent: () => undefined }));
vi.mock("@/modules/dashboard/hooks/useActivityHistory", () => ({ useActivityHistory: () => ({ data: [] }) }));
vi.mock("@/modules/artist/hooks/useArtists", () => ({ useArtists: () => ({ artists: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/modules/releases/hooks/useReleases", () => ({ useReleases: () => ({ releases: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/modules/projects/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/modules/dashboard/hooks/useOperationalDashboard", () => ({
  useOperationalDashboard: () => ({
    dashboard: { artists: 3, artists_by_status: {}, active_contracts_count: 0, contracts_expiring_soon_count: 0, revenue_current_month: 0 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const refetchEvents = vi.fn();
const eventsState: { dashboardEvents: unknown; isLoading: boolean; error: Error | null; refetch: typeof refetchEvents } = {
  dashboardEvents: null, isLoading: false, error: null, refetch: refetchEvents,
};
vi.mock("@/modules/dashboard/hooks/useDashboardEvents", () => ({ useDashboardEvents: () => eventsState }));

import Dashboard from "@/modules/dashboard/pages/Dashboard";

const renderDashboard = () => renderWithProviders(<MemoryRouter><Dashboard /></MemoryRouter>);

describe("<Dashboard /> events", () => {
  beforeEach(() => {
    Object.assign(eventsState, { dashboardEvents: null, isLoading: false, error: null });
    refetchEvents.mockClear();
  });

  it("shows the API month count and the upcoming appointments at their local date and time", async () => {
    eventsState.dashboardEvents = {
      todayCount: 2,
      monthCount: 137,
      upcoming: [{ id: "e-1", title: "Show Noturno", type: "show", status: "confirmed", starts_at: "2030-10-11T00:30:00.000Z" }],
    };
    renderDashboard();
    expect(await screen.findByText("137")).toBeInTheDocument();
    const item = screen.getByTestId("appointment-e-1");
    expect(item).toHaveTextContent("Show Noturno");
    expect(item).toHaveTextContent("10/10/2030");
    expect(item).toHaveTextContent("21:30");
    expect(screen.queryByText("Nenhum compromisso agendado")).not.toBeInTheDocument();
  });

  it("a failed events query is unavailable, not zero events", async () => {
    eventsState.error = new Error("boom");
    renderDashboard();
    expect(await screen.findByText("Agenda indisponível")).toBeInTheDocument();
    expect(screen.getByText("agenda indisponível")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum compromisso agendado")).not.toBeInTheDocument();
  });
});
