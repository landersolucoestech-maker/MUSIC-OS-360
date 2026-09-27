import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMetrics } from "@/modules/dashboard/hooks/useMetrics";

/**
 * Task J — `artistasMetrics.comContrato`/`.ativos` were computed via
 * `artistas.filter(...).length` over useArtistas() (capped at 50/tenant).
 * This test proves that, with the dashboard aggregate available, the KPI uses
 * `artists_by_status` (real COUNT in the database) — not `artistas.length` — and therefore
 * reflects the true total even when `artistas` only loaded the
 * first 50 of a tenant with many more records.
 */

// 50 artists loaded (the old "cap") — none has status "contratado" or
// "ativo" in this sample, simulating the scenario where the artists under contract
// are outside the first page.
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

vi.mock("@/modules/releases/hooks/useReleases", () => ({
  useReleases: () => ({ lancamentos: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("@/modules/projects/hooks/useProjects", () => ({
  useProjects: () => ({ projects: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

// The tenant really has 137 artists — 12 "contratado" and 30 "ativo" — a number
// only the aggregate (real COUNT) can reflect; the capped list above has
// none.
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

describe("useMetrics — artistasMetrics.comContrato/.ativos beyond the cap of 50", () => {
  it("uses the dashboard aggregate (real COUNT), not artistas.length (capped at 50)", () => {
    const { result } = renderHook(() => useMetrics());

    // The capped list has 0 artists with status contratado/ativo (all
    // "prospecto") — if the hook still summed via .filter().length over
    // `artistas`, the KPI would show 0. The aggregate says 12 and 30.
    expect(result.current.artistasMetrics.comContrato).toBe(12);
    expect(result.current.artistasMetrics.ativos).toBe(12 + 30);
    expect(result.current.dashboardMetrics.totalArtistas).toBe(137);
  });

  it("falls back to the capped array only while the aggregate has not loaded", async () => {
    vi.resetModules();
    vi.doMock("@/modules/dashboard/hooks/useOperationalDashboard", () => ({
      useOperationalDashboard: () => ({ dashboard: null, isLoading: true, error: null, refetch: vi.fn() }),
    }));
    const { useMetrics: useMetricsNoAgg } = await import("@/modules/dashboard/hooks/useMetrics");
    const { result } = renderHook(() => useMetricsNoAgg());

    // Without the aggregate, it falls back to the filter over the capped list — 0 (all prospecto).
    expect(result.current.artistasMetrics.comContrato).toBe(0);
  });
});
