// @ts-nocheck
// ArtistVision360Modal — "Financeiro" tab and calendar-day dates (frontend re-review M1/M4):
//   * while the full transaction sweep is loading: a loading state, never zero totals;
//   * when it fails: an error, never "Nenhuma transação vinculada";
//   * contract dates are calendar days (no previous-day shift in America/Sao_Paulo).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return { ...actual, ResponsiveContainer: ({ children }: any) => <div style={{ width: 400, height: 200 }}>{children}</div> };
});

const transactionsState = { transactions: [], truncated: false, total: 0, isLoading: false, error: null };
vi.mock("@/modules/accounting/hooks/useAllTransactions", () => ({
  useAllTransactions: () => transactionsState,
  truncatedTransactionsNotice: () => "",
}));

vi.mock("@/modules/catalog/hooks/useWorks", () => ({ useWorks: () => ({ works: [], isLoading: false }) }));
vi.mock("@/modules/catalog/hooks/usePhonograms", () => ({ usePhonograms: () => ({ phonograms: [], isLoading: false }) }));
vi.mock("@/modules/releases/hooks/useReleases", () => ({ useReleases: () => ({ releases: [], isLoading: false }) }));
vi.mock("@/modules/projects/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], isLoading: false }) }));
vi.mock("@/modules/marketing/hooks/useGoals", () => ({ useGoals: () => ({ goals: [], isLoading: false }) }));
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
vi.mock("@/shared/lib/api-client", () => ({ api: { get: vi.fn(async () => []), post: vi.fn() } }));

import { ArtistVision360Modal } from "@/modules/artist/components/ArtistVision360Modal";

async function openTab(name: RegExp) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ArtistVision360Modal open onOpenChange={() => {}} artist={{ id: "art-1", stageName: "Teste" }} />
    </QueryClientProvider>,
  );
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
    contractsState.contracts = [];
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
});
