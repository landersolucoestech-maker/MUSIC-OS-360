import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ArtistGoalStatus } from "@music-os-360/types";
import { api } from "@/shared/lib/api-client";
import { useCreateGoal, useGoals } from "./useGoals";

vi.mock("@/shared/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const row = {
  id: "g1",
  artist_id: "a1",
  title: "Streams",
  type: "revenue",
  status: "completed",
  target_value: "100",
  current_value: "25",
  start_date: null,
  end_date: null,
  metadata: { description: "desc", category: "financial", unit: "R$" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-02T00:00:00Z",
};

// Regression: the goal form used to send PT-BR status values (em_progresso,
// concluida...) that chk_artist_goals_status rejects, so every save failed.
describe("useGoals (artist_goals canonical contract)", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("sends canonical English values and metadata keys", async () => {
    mockedPost.mockResolvedValue(row);
    const { result } = renderHook(() => useCreateGoal(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      artistId: "a1",
      title: "Streams",
      type: "revenue",
      category: "financial",
      targetValue: 100,
      unit: "R$",
    });

    const [path, body] = mockedPost.mock.calls[0]!;
    expect(path).toBe("/artist-goals");
    expect(body).toMatchObject({
      artist_id: "a1",
      type: "revenue",
      status: ArtistGoalStatus.IN_PROGRESS,
      target_value: "100",
      metadata: { category: "financial", unit: "R$" },
    });
    expect(JSON.stringify(body)).not.toMatch(/em_progresso|categoria|unidade|descricao/);
  });

  it("maps the API row to the canonical goal model", async () => {
    mockedGet.mockResolvedValue([row]);
    const { result } = renderHook(() => useGoals(true, "a1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.goals).toHaveLength(1));
    expect(result.current.goals[0]).toMatchObject({
      type: "revenue",
      status: ArtistGoalStatus.COMPLETED,
      category: "financial",
      description: "desc",
      targetValue: 100,
      currentValue: 25,
      progress: 25,
    });
  });

  it("never exposes an unknown technical type or status value", async () => {
    mockedGet.mockResolvedValue([{ ...row, type: "likes", status: "whatever" }]);
    const { result } = renderHook(() => useGoals(true, "a1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.goals).toHaveLength(1));
    expect(result.current.goals[0]!.type).toBe("other");
    expect(result.current.goals[0]!.status).toBe(ArtistGoalStatus.IN_PROGRESS);
  });
});
