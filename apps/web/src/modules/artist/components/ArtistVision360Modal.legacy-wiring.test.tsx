// @ts-nocheck
// Compat wiring of ArtistVision360Modal: legacy-shaped data (legacy release/status slugs, legacy
// transaction categories, legacy contract types, coarse event types) goes through the real
// consumer and must come out as canonical/PT-BR visible output.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  releases: [] as any[],
  projects: [] as any[],
  contracts: [] as any[],
  transactions: [] as any[],
  events: [] as any[],
}));

vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return { ...actual, ResponsiveContainer: ({ children }: any) => <div style={{ width: 400, height: 200 }}>{children}</div> };
});
vi.mock("@/modules/catalog/hooks/useWorks", () => ({ useWorks: () => ({ works: [], isLoading: false }) }));
vi.mock("@/modules/catalog/hooks/usePhonograms", () => ({ usePhonograms: () => ({ phonograms: [], isLoading: false }) }));
vi.mock("@/modules/releases/hooks/useReleases", () => ({ useReleases: () => ({ releases: state.releases, isLoading: false }) }));
vi.mock("@/modules/projects/hooks/useProjects", () => ({ useProjects: () => ({ projects: state.projects, isLoading: false }) }));
vi.mock("@/modules/marketing/hooks/useGoals", () => ({ useGoals: () => ({ goals: [], isLoading: false }) }));
vi.mock("@/modules/contracts/hooks/useContracts", () => ({ useContracts: () => ({ contracts: state.contracts, isLoading: false }) }));
vi.mock("@/modules/accounting/hooks/useAllTransactions", async () => {
  const actual: any = await vi.importActual("@/modules/accounting/hooks/useAllTransactions");
  return {
    ...actual,
    useAllTransactions: () => ({
      transactions: state.transactions,
      truncated: false,
      total: state.transactions.length,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});
vi.mock("@/modules/events/hooks/useArtistEvents", () => ({
  useArtistEvents: () => ({ events: state.events, isLoading: false, error: null, truncated: false, refetch: vi.fn() }),
}));
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
vi.mock("@/shared/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { ArtistVision360Modal } from "@/modules/artist/components/ArtistVision360Modal";
import { api } from "@/shared/lib/api-client";

const ARTIST = { id: "art-1", stageName: "Teste", spotifyUrl: null, youtubeUrl: null };

async function openTab(name: RegExp) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ArtistVision360Modal open onOpenChange={() => {}} artist={ARTIST} />
    </QueryClientProvider>,
  );
  const tab = screen.getByRole("tab", { name });
  await act(async () => {
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
  });
}

beforeEach(() => {
  state.releases = [];
  state.projects = [];
  state.contracts = [];
  state.transactions = [];
  state.events = [];
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.get).mockResolvedValue([]);
});

describe("ArtistVision360Modal catalog tab: release and status labels", () => {
  it("releases with legacy / backend statuses show the PT-BR display label, never the raw status", async () => {
    state.releases = [
      { id: "r1", title: "Lançamento Rejeitado", status: "rejeitado", release_date: "2026-01-10" },
      { id: "r2", title: "Lançamento Removido", status: "remocao", release_date: "2026-01-11" },
      { id: "r3", title: "Lançamento No Ar", status: "released", release_date: "2026-01-12" },
      { id: "r4", title: "Lançamento Plataforma", status: "draft", platform_status: "on_hold", release_date: "2026-01-13" },
      { id: "r5", title: "Lançamento Desconhecido", status: "status-estranho", release_date: "2026-01-14" },
    ];
    await openTab(/cat[aá]logo/i);
    const rowOf = (title: string) => screen.getByText(title).closest("div.flex.items-center.justify-between") as HTMLElement;
    expect(rowOf("Lançamento Rejeitado")).toHaveTextContent("Rejeitado");
    expect(rowOf("Lançamento Removido")).toHaveTextContent("Takedown");
    expect(rowOf("Lançamento No Ar")).toHaveTextContent("Distribuído");
    expect(rowOf("Lançamento Plataforma")).toHaveTextContent("Em Espera");
    // negative: an unknown status falls to the closed display set, the raw value never shows
    expect(rowOf("Lançamento Desconhecido")).toHaveTextContent("Incompleto");
    for (const raw of ["rejeitado", "remocao", "released", "rejected", "takedown", "distributed", "on_hold", "incomplete", "status-estranho"]) {
      expect(screen.queryByText(raw)).toBeNull();
    }
  });

  it("project status chips for legacy Portuguese status keys show the PT-BR label", async () => {
    state.projects = [
      { id: "p1", title: "Projeto Andamento", type: "single", status: "em_andamento" },
      { id: "p2", title: "Projeto Pendente", type: "single", status: "pendente" },
      { id: "p3", title: "Projeto Concluido", type: "single", status: "concluido" },
    ];
    await openTab(/cat[aá]logo/i);
    const chipOf = (title: string) => screen.getByText(title).closest("div.flex.items-center.justify-between") as HTMLElement;
    expect(chipOf("Projeto Andamento")).toHaveTextContent("Em Andamento");
    expect(chipOf("Projeto Pendente")).toHaveTextContent("Pendente");
    expect(chipOf("Projeto Concluido")).toHaveTextContent("Concluído");
    for (const raw of ["em_andamento", "pendente", "concluido", "pending", "completed", "in_progress"]) {
      expect(screen.queryByText(raw)).toBeNull();
    }
  });
});

const tx = (id: string, category: string, amount: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "revenue",
  status: "paid",
  amount,
  category,
  description: `Transação ${id}`,
  transaction_date: "2026-02-01",
  ...extra,
});

const natureCell = (label: string) => screen.getByText(label, { selector: "p.text-xs" }).parentElement as HTMLElement;

describe("ArtistVision360Modal finance tab", () => {
  it("revenue by nature buckets stored legacy and canonical categories into exactly their own bucket", async () => {
    state.transactions = [
      // legacy slug whose raw spelling has no keyword ("sinc" != "sync"): only the canonical id lands it in Licenciamentos
      tx("t1", "sincronizacao", "250.00"),
      // legacy slug matched by its raw spelling
      tx("t2", "cache-show", "100.00"),
      // canonical id
      tx("t3", "sponsorship", "40.00"),
      // legacy slug with no bucket at all: counted only in "Outros"
      tx("t4", "receitas-musicais", "7.00"),
    ];
    await openTab(/financeiro/i);

    expect(natureCell("Licenciamentos")).toHaveTextContent("250,00");
    expect(natureCell("Shows")).toHaveTextContent("100,00");
    expect(natureCell("Publicidade")).toHaveTextContent("40,00");
    expect(natureCell("Outros")).toHaveTextContent("7,00");
    // negative: untouched buckets stay at zero, nothing lands in every bucket
    expect(natureCell("Royalties")).toHaveTextContent("0,00");
    expect(natureCell("Distribuição")).toHaveTextContent("0,00");
    expect(natureCell("Licenciamentos")).not.toHaveTextContent("390,00");
    expect(natureCell("Outros")).not.toHaveTextContent("0,00");
  });

  it("latest transactions show the PT-BR category label of a legacy slug, never the raw slug", async () => {
    state.transactions = [tx("t1", "caches", "10.00"), tx("t2", "receitas-musicais", "20.00")];
    await openTab(/financeiro/i);
    const rowOf = (id: string) => screen.getByText(`Transação ${id}`).closest("div.flex-1") as HTMLElement;
    expect(rowOf("t1")).toHaveTextContent("· Cachês");
    expect(rowOf("t2")).toHaveTextContent("· Receitas Musicais");
    for (const id of ["t1", "t2"]) {
      expect(rowOf(id).textContent).not.toMatch(/caches|receitas-musicais|performance_fees|music_revenue/);
    }
  });
});

describe("ArtistVision360Modal contracts tab type filter", () => {
  const contracts = () => [
    { id: "c1", title: "Contrato Distribuicao Legado", type: "distribuicao", status: "signed" },
    { id: "c2", title: "Contrato Exclusivo Legado", type: "exclusivo", status: "signed" },
    { id: "c3", title: "Contrato Licenciamento", type: "licensing", status: "signed" },
  ];

  it("filter 'Distribuição' keeps the contract stored as 'distribuicao' and hides the others", async () => {
    state.contracts = contracts();
    await openTab(/contratos/i);
    expect(screen.getByText("Contratos (3)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Distribuição" }));
    expect(screen.getByText("Contratos (1)")).toBeInTheDocument();
    expect(screen.getByText("Contrato Distribuicao Legado")).toBeInTheDocument();
    expect(screen.queryByText("Contrato Exclusivo Legado")).toBeNull();
    expect(screen.queryByText("Contrato Licenciamento")).toBeNull();
  });

  it("filter 'Empresarial' keeps the legacy 'exclusivo' contract only; 'Licenciamento' keeps the canonical one only", async () => {
    state.contracts = contracts();
    await openTab(/contratos/i);

    fireEvent.click(screen.getByRole("button", { name: "Empresarial" }));
    expect(screen.getByText("Contrato Exclusivo Legado")).toBeInTheDocument();
    expect(screen.queryByText("Contrato Distribuicao Legado")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Licenciamento" }));
    expect(screen.getByText("Contrato Licenciamento")).toBeInTheDocument();
    expect(screen.queryByText("Contrato Exclusivo Legado")).toBeNull();

    // negative: a filter with no match lists nothing; 'Todos' restores everything
    fireEvent.click(screen.getByRole("button", { name: "Serviços" }));
    expect(screen.getByText("Contratos (0)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByText("Contratos (3)")).toBeInTheDocument();
  });
});

describe("ArtistVision360Modal agenda and activity: event type labels", () => {
  const events = () => [
    { id: "e1", title: "Show do Verão", type: "show", status: "agendado", starts_at: "2026-03-10T21:00:00-03:00", venue: "Arena" },
    { id: "e2", title: "Sessão Estúdio", type: "recording", status: "pending", starts_at: "2026-03-11T15:00:00-03:00" },
    { id: "e3", title: "Sem Tipo", status: "pending", starts_at: "2026-03-12T15:00:00-03:00" },
  ];

  it("agenda rows show the PT-BR label of the coarse event type, never the enum", async () => {
    state.events = events();
    await openTab(/agenda/i);
    const rowOf = (title: string) => screen.getByText(title).parentElement as HTMLElement;
    expect(within(rowOf("Show do Verão")).getByText("Show")).toBeInTheDocument();
    expect(within(rowOf("Sessão Estúdio")).getByText("Gravação/Estúdio")).toBeInTheDocument();
    expect(within(rowOf("Sem Tipo")).getByText("Evento")).toBeInTheDocument();
    expect(screen.queryByText("show")).toBeNull();
    expect(screen.queryByText("recording")).toBeNull();
    // the event status chip is PT-BR as well, never the legacy slug
    expect(within(rowOf("Show do Verão")).queryByText("agendado")).toBeNull();
    expect(within(rowOf("Show do Verão")).getByText("Agendado")).toBeInTheDocument();
  });

  it("activity (Movimentação) descriptions of events use the PT-BR type label", async () => {
    state.events = events();
    await openTab(/movimenta/i);
    expect(screen.getByText("Show: Show do Verão")).toBeInTheDocument();
    expect(screen.getByText("Gravação/Estúdio: Sessão Estúdio")).toBeInTheDocument();
    expect(screen.getByText("Evento: Sem Tipo")).toBeInTheDocument();
    expect(screen.queryByText(/^show:/)).toBeNull();
    expect(screen.queryByText(/undefined:/)).toBeNull();
  });
});
