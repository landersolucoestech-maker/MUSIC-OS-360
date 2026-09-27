import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useProjects } from "./useProjects";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, list: vi.fn() } };
});

const mockedList = vi.mocked(storage.list);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Regression: QueryProjectDto (apps/api) only accepts the "artistId" query param
// (Task H aligned DTO/service on that name). Sending "artist_id" — as the hook
// used to — is rejected with 400 by the ValidationPipe whitelist, which
// silently broke the Projects tab of the artist 360° view modal.
describe("useProjects", () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedList.mockResolvedValue([]);
  });

  it("filters by artistId (not artist_id) when fetching an artist's projects", async () => {
    renderHook(() => useProjects(true, "artist-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    const [, options] = mockedList.mock.calls[0]!;
    expect(options?.filters).toEqual({ artistId: "artist-1" });
    expect(options?.filters).not.toHaveProperty("artist_id");
  });

  it("without artistId, applies no artist filter", async () => {
    renderHook(() => useProjects(true), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    const [, options] = mockedList.mock.calls[0]!;
    expect(options?.filters).toBeUndefined();
  });
});
