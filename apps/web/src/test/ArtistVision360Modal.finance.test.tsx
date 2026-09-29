// @ts-nocheck
// ArtistVision360Modal — transaction-derived totals and dates (frontend re-reviews
// M1/M4 of ceea2e4, N1-N3 of b875241):
//   * while the full transaction sweep is loading: a loading state, never zero
//     totals — on the finance tab AND the default (overview) tab;
//   * when it fails: an error with a retry, never the empty-list message;
//   * calendar-day fields (contract/release/goal dates) are never shifted, and a
//     real instant (a show at 21:30 in America/Sao_Paulo) stays on its own day.
// The timezone is pinned to America/Sao_Paulo (like the sibling date tests): in UTC
// the shifting bugs these cases guard against would not reproduce.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { act } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return { ...actual, ResponsiveContainer: ({ children }: any) => <div style={{ width: 400, height: 200 }}>{children}</div> };
});

const originalTz = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/Sao_Paulo"; });
afterAll(() => { process.env.TZ = originalTz; });

const refetchTransactions = vi.fn();
const transactionsState = { transactions: [], truncated: false, total: 0, isLoading: false, error: null, refetch: refetchTransactions };
vi.mock("@/modules/accounting/hooks/useAllTransactions", () => ({
  useAllTransactions: () => transactionsState,
  truncatedTransactionsNotice: () => "",
}));

vi.mock("@/modules/catalog/hooks/useWorks", () => ({ useWorks: () => ({ works: [], isLoading: false }) }));
vi.mock("@/modules/catalog/hooks/usePhonograms", () => ({ usePhonograms: () => ({ phonograms: [], isLoading: false }) }));
const releasesState = { releases: [], isLoading: false };
vi.mock("@/modules/releases/hooks/useReleases", () => ({ useReleases: () => releasesState }));
const eventsState = { events: [] as unknown[], isLoading: false, error: null as Error | null, truncated: false, refetch: vi.fn() };
vi.mock("@/modules/events/hooks/useArtistEvents", () => ({ useArtistEvents: () => eventsState }));
vi.mock("@/modules/projects/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], isLoading: false }) }));
const goalsState = { goals: [], isLoading: false, getProgressPercent: () => 10, addGoal: vi.fn(), updateGoal: vi.fn(), deleteGoal: vi.fn() };
vi.mock("@/modules/marketing/hooks/useGoals", () => ({ useGoals: () => goalsState }));
const contractsState = { contracts: [], isLoading: false };
vi.mock("@/modules/contracts/hooks/useContracts", () => ({ useContracts: () => contractsState }));
vi.mock("@/app/providers/TenantContext", () => ({
  useTenant: () => ({
    tenant: { id: "tenant-test", name: "Tenant Teste", permissions: {} },
    permissionKeys: ["*"],
    isFeatureEnabled: () => true,
    hasPermission: () => true,
    canRead: () => true,
    canWrite: () => true,
    canDelete: () => true,
    canExport: () => true,
    setTenant: vi.fn(),
  }),
}));
// Skill-run card with its own endpoint (not under test; the blanket api.get mock returns []).
vi.mock("@/modules/artist/components/PositioningCard", () => ({ PositioningCard: () => null }));
vi.mock("@/shared/lib/api-client", () => ({ api: { get: vi.fn(async () => []), post: vi.fn() } }));

import { ArtistVision360Modal } from "@/modules/artist/components/ArtistVision360Modal";

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ArtistVision360Modal open onOpenChange={() => {}} artist={{ id: "art-1", stageName: "Teste" }} />
    </QueryClientProvider>,
  );
}

async function openTab(name: RegExp) {
  renderModal();
  const tab = screen.getByRole("tab", { name });
  await act(async () => {
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
  });
}

describe("<ArtistVision360Modal /> finance tab states", () => {
  beforeEach(() => {
    Object.assign(transactionsState, { transactions: [], isLoading: false, error: null });
    refetchTransactions.mockClear();
    contractsState.contracts = [];
    releasesState.releases = [];
    Object.assign(eventsState, { events: [], isLoading: false, error: null, truncated: false });
    eventsState.refetch.mockClear();
    goalsState.goals = [];
  });

  it("shows a loading state (no zero totals, no empty state) while the sweep is loading", async () => {
    transactionsState.isLoading = true;
    await openTab(/financeiro/i);
    expect(await screen.findByTestId("vision360-finance-loading")).toHaveTextContent("Carregando transações");
    expect(screen.queryByText("Nenhuma transação vinculada a este artista")).not.toBeInTheDocument();
    expect(screen.queryByText("Receitas Totais")).not.toBeInTheDocument();
  });

  it("shows an error (not an empty state) when the sweep fails", async () => {
    transactionsState.error = new Error("boom");
    await openTab(/financeiro/i);
    expect(await screen.findByTestId("vision360-finance-error")).toHaveTextContent("Não foi possível carregar as transações");
    expect(screen.queryByText("Nenhuma transação vinculada a este artista")).not.toBeInTheDocument();
  });

  it("renders the totals once loaded", async () => {
    await openTab(/financeiro/i);
    expect(await screen.findByText("Receitas Totais")).toBeInTheDocument();
    expect(screen.queryByTestId("vision360-finance-loading")).not.toBeInTheDocument();
  });

  it("contract dates stored as UTC midnight render as the stored calendar day", async () => {
    contractsState.contracts = [{ id: "c-1", title: "Contrato X", status: "signed", start_date: "2026-09-01T00:00:00.000Z", end_date: "2027-08-31T00:00:00.000Z" }];
    await openTab(/contratos/i);
    expect(await screen.findByText(/01\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/31\/08\/2027/)).toBeInTheDocument();
    expect(screen.queryByText(/31\/08\/2026/)).not.toBeInTheDocument();
  });

  it("shows the finance tab error with a retry that refetches the sweep", async () => {
    transactionsState.error = new Error("boom");
    await openTab(/financeiro/i);
    fireEvent.click(within(await screen.findByTestId("vision360-finance-error")).getByRole("button", { name: "Tentar novamente" }));
    expect(refetchTransactions).toHaveBeenCalledTimes(1);
  });

  it("default tab: no R$ 0,00 while the sweep is loading", async () => {
    transactionsState.isLoading = true;
    renderModal();
    expect(await screen.findByTestId("vision360-overview-revenue")).toHaveTextContent("Carregando…");
    expect(screen.getByTestId("vision360-overview-finance-loading")).toHaveTextContent("Carregando transações");
    expect(screen.queryByTestId("vision360-overview-finance-values")).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$\s*0,00/)).not.toBeInTheDocument();
  });

  it("default tab: no R$ 0,00 after the sweep failed, and a retry", async () => {
    transactionsState.error = new Error("boom");
    renderModal();
    expect(await screen.findByTestId("vision360-overview-revenue")).toHaveTextContent("Indisponível");
    expect(screen.queryByText(/R\$\s*0,00/)).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("vision360-overview-finance-error")).getByRole("button", { name: "Tentar novamente" }));
    expect(refetchTransactions).toHaveBeenCalledTimes(1);
  });

  it("default tab: totals render once loaded", async () => {
    transactionsState.transactions = [{ id: "t-1", type: "revenue", amount: 1500, status: "paid", created_at: "2026-09-01T12:00:00.000Z" }];
    renderModal();
    expect(await screen.findByTestId("vision360-overview-finance-values")).toHaveTextContent(/R\$\s*1\.500,00/);
    expect(screen.getByTestId("vision360-overview-revenue")).toHaveTextContent(/R\$\s*1\.500,00/);
  });

  it("an evening show (21:30 in America/Sao_Paulo = next day in UTC) stays on its own day", async () => {
    // "Próximo Show" only lists future shows: pin the clock so the fixture stays in the future.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T12:00:00.000Z"));
    eventsState.events = [{ id: "e-1", title: "Show Noturno", type: "show", status: "confirmed", starts_at: "2030-10-11T00:30:00.000Z" }];
    renderModal();
    expect(await screen.findByText("10/10/2030")).toBeInTheDocument();
    expect(screen.queryByText(/11[-/]10[-/]2030/)).not.toBeInTheDocument();
    await act(async () => {
      const tab = screen.getByRole("tab", { name: /agenda/i });
      fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
      fireEvent.mouseDown(tab, { button: 0 });
      fireEvent.click(tab);
    });
    expect(await screen.findByText("21:30")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("default tab: no zero shows / 'Nenhum agendado' while the artist events load", async () => {
    eventsState.isLoading = true;
    renderModal();
    expect(await screen.findByTestId("vision360-overview-confirmed-shows")).toHaveTextContent("Carregando…");
    expect(screen.getByTestId("vision360-overview-next-show")).toHaveTextContent("Carregando…");
    // Only the next-release widget (no events involved) may say "Nenhum agendado".
    expect(screen.getAllByText("Nenhum agendado")).toHaveLength(1);
    expect(screen.getByTestId("vision360-events-loading")).toBeInTheDocument();
  });

  it("default tab: after the events sweep failed, unavailable values and a retry", async () => {
    eventsState.error = new Error("boom");
    renderModal();
    expect(await screen.findByTestId("vision360-overview-confirmed-shows")).toHaveTextContent("Indisponível");
    expect(screen.getByTestId("vision360-overview-next-show")).toHaveTextContent("Indisponível");
    expect(screen.getAllByText("Nenhum agendado")).toHaveLength(1);
    fireEvent.click(within(screen.getByTestId("vision360-events-error")).getByRole("button", { name: "Tentar novamente" }));
    expect(eventsState.refetch).toHaveBeenCalledTimes(1);
  });

  it("the next release date stored as UTC midnight renders as the stored calendar day", async () => {
    releasesState.releases = [{ id: "r-1", title: "Single X", release_date: "2030-11-01T00:00:00.000Z", status: "scheduled" }];
    renderModal();
    expect(await screen.findByText("01/11/2030")).toBeInTheDocument();
    expect(screen.queryByText(/31[-/]10[-/]2030/)).not.toBeInTheDocument();
  });

  it("goal dates stored as UTC midnight render as the stored calendar days", async () => {
    goalsState.goals = [{
      id: "g-1", title: "Meta X", description: "", type: "streams", category: "digital", unit: "streams",
      targetValue: 100, currentValue: 10, status: "active",
      startDate: "2030-01-01T00:00:00.000Z", endDate: "2030-12-31T00:00:00.000Z",
    }];
    await openTab(/marketing/i);
    expect(await screen.findByText(/01\/01\/2030/)).toBeInTheDocument();
    expect(screen.getByText(/31\/12\/2030/)).toBeInTheDocument();
    expect(screen.queryByText(/31\/12\/2029|30\/12\/2030/)).not.toBeInTheDocument();
  });

  it("agenda tab: an events failure shows an error with retry, not an empty agenda", async () => {
    eventsState.error = new Error("boom");
    await openTab(/agenda/i);
    const alert = await screen.findByTestId("vision360-events-error");
    expect(screen.queryByText("Nenhum compromisso na agenda")).not.toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect(eventsState.refetch).toHaveBeenCalledTimes(1);
  });
});
