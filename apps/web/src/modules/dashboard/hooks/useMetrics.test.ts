import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMetrics } from "@/modules/dashboard/hooks/useMetrics";

/**
 * Task J — `artistasMetrics.comContrato`/`.ativos` eram calculados via
 * `artistas.filter(...).length` sobre useArtistas() (capada a 50/tenant).
 * Este teste prova que, com o agregado do dashboard disponível, o KPI usa
 * `artists_by_status` (COUNT real no banco) — não `artistas.length` — e por
 * isso reflete o total verdadeiro mesmo quando `artistas` só carregou os
 * primeiros 50 de um tenant com muito mais registros.
 */

// 50 artistas carregados (o "cap" antigo) — nenhum tem status "contratado" ou
// "ativo" nessa amostra, simulando o cenário onde os artistas com contrato
// estão fora da primeira página.
const CAPPED_ARTISTAS = Array.from({ length: 50 }, (_, i) => ({
  id: `artist-${i + 1}`,
  stageName: `Artista ${i + 1}`,
  musicGenre: null,
  status: "prospect",
  contractId: null,
}));

vi.mock("@/modules/artist/hooks/useArtists", () => ({
  useArtists: () => ({
    artists: CAPPED_ARTISTAS,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/modules/events/hooks/useEvents", () => ({
  useEvents: () => ({ events: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("@/modules/releases/hooks/useLancamentos", () => ({
  useLancamentos: () => ({ lancamentos: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("@/modules/projects/hooks/useProjects", () => ({
  useProjects: () => ({ projects: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

// Tenant tem, de verdade, 137 artistas — 12 "contratado" e 30 "ativo" — número
// que só o agregado (COUNT real) consegue refletir; a lista capada acima não
// tem nenhum.
vi.mock("@/modules/dashboard/hooks/useOperationalDashboard", () => ({
  useOperationalDashboard: () => ({
    dashboard: {
      artists: 137,
      artists_by_status: { signed: 12, active: 30, prospect: 95 },
      active_contracts_count: 0,
      contracts_expiring_soon_count: 0,
      revenue_current_month: 0,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("useMetrics — artistasMetrics.comContrato/.ativos além do cap de 50", () => {
  it("usa o agregado do dashboard (COUNT real), não artistas.length (capado a 50)", () => {
    const { result } = renderHook(() => useMetrics());

    // A lista capada tem 0 artistas com status contratado/ativo (todos
    // "prospecto") — se o hook ainda somasse via .filter().length sobre
    // `artistas`, o KPI mostraria 0. O agregado diz 12 e 30.
    expect(result.current.artistasMetrics.comContrato).toBe(12);
    expect(result.current.artistasMetrics.ativos).toBe(12 + 30);
    expect(result.current.dashboardMetrics.totalArtistas).toBe(137);
  });

  it("cai para o array capado só quando o agregado ainda não carregou", async () => {
    vi.resetModules();
    vi.doMock("@/modules/dashboard/hooks/useOperationalDashboard", () => ({
      useOperationalDashboard: () => ({ dashboard: null, isLoading: true, error: null, refetch: vi.fn() }),
    }));
    const { useMetrics: useMetricsNoAgg } = await import("@/modules/dashboard/hooks/useMetrics");
    const { result } = renderHook(() => useMetricsNoAgg());

    // Sem agregado, cai para o filter sobre a lista capada — 0 (todos prospecto).
    expect(result.current.artistasMetrics.comContrato).toBe(0);
  });
});
