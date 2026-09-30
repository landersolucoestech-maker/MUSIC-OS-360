import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEntityLookup, useEntityById } from "@/shared/hooks/useEntityLookup";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, listPaged: vi.fn(), findById: vi.fn() } };
});

const mockedListPaged = vi.mocked(storage.listPaged);
const mockedFindById = vi.mocked(storage.findById);

interface FakeRow { id: string; name: string }

// 75 records — more than the backend's old limit=50 default.
const FAKE_DATASET: FakeRow[] = Array.from({ length: 75 }, (_, i) => ({
  id: `id-${i + 1}`,
  name: `Artista ${i + 1}`,
}));

function fakeBackend(_table: string, options: { page: number; pageSize: number; filters?: Record<string, unknown> }) {
  const search = (options.filters?.search as string | undefined)?.toLowerCase();
  const rows = search ? FAKE_DATASET.filter((r) => r.name.toLowerCase().includes(search)) : FAKE_DATASET.slice(0, options.pageSize);
  const total = search ? rows.length : FAKE_DATASET.length;
  return Promise.resolve({
    items: rows.slice(0, options.pageSize), page: options.page, pageSize: options.pageSize, total,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  });
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Real debounce (300ms in useDebounce) — we use real time instead of fake
// timers so as not to block testing-library's internal waitFor polling.
const settle = (ms = 350) => new Promise((r) => setTimeout(r, ms));

describe("useEntityLookup", () => {
  beforeEach(() => {
    mockedListPaged.mockReset();
    mockedListPaged.mockImplementation(fakeBackend as typeof storage.listPaged);
  });

  it("finds record #75 by searching part of the name (beyond the old cap of 50)", async () => {
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) => useEntityLookup<FakeRow>({ table: "artists", search, enabled: true }),
      { wrapper: createWrapper(), initialProps: { search: "" } },
    );

    rerender({ search: "Artista 75" });
    await waitFor(() => expect(result.current.items.some((i) => i.id === "id-75")).toBe(true), { timeout: 2000 });
  });

  it("debounce: fast typing does not fire one request per keystroke", async () => {
    const { rerender } = renderHook(
      ({ search }: { search: string }) => useEntityLookup<FakeRow>({ table: "artists", search, enabled: true }),
      { wrapper: createWrapper(), initialProps: { search: "" } },
    );
    mockedListPaged.mockClear();

    for (const partial of ["A", "Ar", "Art", "Arti", "Artis", "Artist", "Artista"]) {
      rerender({ search: partial });
      await settle(50); // well below the 300ms debounce
    }
    // Not settled yet — no request should have fired yet.
    expect(mockedListPaged).not.toHaveBeenCalled();

    await waitFor(() => expect(mockedListPaged).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect((mockedListPaged.mock.calls[0][1] as { filters?: Record<string, unknown> }).filters?.search).toBe("Artista");
  });

  it("an empty search + enabled does not cause a storm of repeated requests", async () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useEntityLookup<FakeRow>({ table: "artists", search: "", enabled }),
      { wrapper: createWrapper(), initialProps: { enabled: false } },
    );
    mockedListPaged.mockClear();

    rerender({ enabled: true });
    await waitFor(() => expect(mockedListPaged).toHaveBeenCalledTimes(1), { timeout: 2000 });

    // Subsequent re-renders with the same parameters must not re-fire.
    rerender({ enabled: true });
    rerender({ enabled: true });
    await settle();
    expect(mockedListPaged).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when enabled=false (e.g. closed popover)", async () => {
    renderHook(
      () => useEntityLookup<FakeRow>({ table: "artists", search: "qualquer coisa", enabled: false }),
      { wrapper: createWrapper() },
    );
    await settle();
    expect(mockedListPaged).not.toHaveBeenCalled();
  });

  it("changing the search creates a new query (distinct queryKey/AbortSignal), never reuses the stale request", async () => {
    const signals: AbortSignal[] = [];
    // Artificial delay: the first request must still be "in flight" when
    // the second search fires, to prove they are independent requests
    // (not reused) even when overlapping in time.
    mockedListPaged.mockImplementation((async (
      table: string,
      options: { page: number; pageSize: number; filters?: Record<string, unknown>; signal?: AbortSignal },
    ) => {
      if (options.signal) signals.push(options.signal);
      await settle(150);
      return fakeBackend(table, options);
    }) as typeof storage.listPaged);

    const { rerender } = renderHook(
      ({ search }: { search: string }) => useEntityLookup<FakeRow>({ table: "artists", search, enabled: true }),
      { wrapper: createWrapper(), initialProps: { search: "Artista 1" } },
    );
    await waitFor(() => expect(signals.length).toBe(1), { timeout: 2000 });
    const firstSignal = signals[0];

    // New search before the first one resolves (still within the 150ms delay).
    rerender({ search: "Artista 2" });
    await waitFor(() => expect(signals.length).toBe(2), { timeout: 2000 });

    // Each search gets its own AbortSignal (React Query never reuses the
    // controller of a previous query) — the stale query is marked
    // for cancellation as soon as it has no observers.
    expect(signals[1]).not.toBe(firstSignal);
    const secondSearchFilters = (mockedListPaged.mock.calls[1][1] as { filters?: Record<string, unknown> }).filters;
    expect(secondSearchFilters?.search).toBe("Artista 2");
  });
});

describe("useEntityById", () => {
  beforeEach(() => {
    mockedFindById.mockReset();
  });

  it("resolves a record beyond the first 50 via a direct GET /:resource/:id", async () => {
    mockedFindById.mockResolvedValue({ id: "id-75", name: "Artista 75" });
    const { result } = renderHook(() => useEntityById<FakeRow>("artists", "id-75"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.entity?.id).toBe("id-75"));
    expect(mockedFindById).toHaveBeenCalledWith("artists", "id-75");
  });

  it("does not fetch when the id is null/undefined", async () => {
    renderHook(() => useEntityById<FakeRow>("artists", undefined), { wrapper: createWrapper() });
    expect(mockedFindById).not.toHaveBeenCalled();
  });
});
