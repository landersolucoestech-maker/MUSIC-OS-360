import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const apiGet = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/api-client", () => ({ api: { get: apiGet } }));
vi.mock("@/shared/hooks/usePaginatedDataQuery", () => ({ usePaginatedDataQuery: vi.fn() }));

import { useReleasesDistributionStats } from "./useReleasesPaginated";

async function statsFor(rows: { status: string; has_required: boolean; cnt: number }[]) {
  apiGet.mockResolvedValueOnce(rows);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useReleasesDistributionStats(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result.current.kpis;
}

// Raw statuses are bucketed with the same classifier as the cards: released/Released collapse into
// "distributed", legacy Portuguese ones (rejeitado) and unknown values into "waiting action".
describe("useReleasesDistributionStats bucket classification", () => {
  it("buckets backend and legacy statuses into their canonical KPI bucket", async () => {
    const kpis = await statsFor([
      { status: "released", has_required: true, cnt: 3 },
      { status: "Distributed", has_required: true, cnt: 2 },
      { status: "review", has_required: true, cnt: 4 },
      { status: "scheduled", has_required: true, cnt: 1 },
      { status: "draft", has_required: false, cnt: 5 },
      { status: "rejeitado", has_required: false, cnt: 7 },
      { status: "take_down", has_required: false, cnt: 11 },
      { status: "cancelled", has_required: false, cnt: 13 },
      { status: "totally_unknown", has_required: false, cnt: 17 },
    ]);
    expect(kpis).toEqual({
      total: 3 + 2 + 4 + 1 + 5 + 7 + 11 + 13 + 17,
      distributed: 3 + 2,
      pending: 4 + 1,
      waitingAction: 5 + 7 + 11 + 13 + 17,
    });
  });

  it("approved releases are counted only in the total (no operational bucket)", async () => {
    const kpis = await statsFor([{ status: "approved", has_required: true, cnt: 6 }]);
    expect(kpis).toEqual({ total: 6, distributed: 0, pending: 0, waitingAction: 0 });
  });
});
