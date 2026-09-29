import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** 48de4bb N4: an artist's events are swept completely (server-filtered, starts_at ascending), with `truncated`. */
const fetchAllPages = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/exportAll", () => ({ fetchAllPages }));

import { useArtistEvents } from "./useArtistEvents";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe("useArtistEvents", () => {
  beforeEach(() => {
    fetchAllPages.mockReset();
  });

  it("sweeps the artist's events on the server, oldest first, and reports truncation", async () => {
    fetchAllPages.mockResolvedValue({ items: [{ id: "e1" }], total: 7000, truncated: true });
    const { result } = renderHook(() => useArtistEvents("artist-1"), { wrapper });
    await waitFor(() => expect(result.current.events).toEqual([{ id: "e1" }]));
    expect(result.current.truncated).toBe(true);
    expect(fetchAllPages).toHaveBeenCalledWith("events", expect.objectContaining({
      filters: { artist_id: "artist-1" },
      orderBy: { column: "starts_at", ascending: true },
    }));
  });

  it("does not fetch without an artist, and a failed sweep is an error, not an empty agenda", async () => {
    renderHook(() => useArtistEvents(undefined), { wrapper });
    expect(fetchAllPages).not.toHaveBeenCalled();
    fetchAllPages.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useArtistEvents("artist-2"), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.events).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
