import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, listPaged: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } };
});

const mockedListPaged = vi.mocked(storage.listPaged);

interface FakeRow {
  id: string;
  nome: string;
}

// Simula um tenant com 75 registros — mais que o antigo default de 50 do
// backend — para provar que a paginação real alcança além da página onde o
// limite antigo travava tudo silenciosamente.
const FAKE_DATASET: FakeRow[] = Array.from({ length: 75 }, (_, i) => ({
  id: `id-${i + 1}`,
  nome: `Registro ${i + 1}`,
}));

function usePaginatedFakeRows(config: Parameters<typeof usePaginatedDataQuery<FakeRow>>[0]) {
  return usePaginatedDataQuery<FakeRow>(config);
}

function fakeBackend(_table: string, options: { page: number; pageSize: number; filters?: Record<string, unknown>; signal?: AbortSignal }) {
  let rows = FAKE_DATASET;
  const search = options.filters?.search as string | undefined;
  if (search) rows = rows.filter((r) => r.nome.toLowerCase().includes(search.toLowerCase()));
  const status = options.filters?.status as string | undefined;
  if (status) rows = []; // nenhum registro fake tem status — simula filtro restritivo
  const total = rows.length;
  const offset = Math.max(0, options.page - 1) * options.pageSize;
  const items = rows.slice(offset, offset + options.pageSize);
  return Promise.resolve({
    items, page: options.page, pageSize: options.pageSize, total,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  });
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("usePaginatedDataQuery", () => {
  beforeEach(() => {
    mockedListPaged.mockReset();
    mockedListPaged.mockImplementation(fakeBackend as typeof storage.listPaged);
  });

  it("reaches records beyond the 50th via real pagination (75-record dataset)", async () => {
    // Página 6 com pageSize 10 = offset 50 → itens 51-60, inacessíveis sob o
    // antigo limit=50 default do backend sem paginação real.
    const { result } = renderHook(
      () => usePaginatedFakeRows({ queryKey: ["fake"], table: "artistas", page: 6, pageSize: 10 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.total).toBe(75);
    expect(result.current.items).toHaveLength(10);
    expect(result.current.items[0].id).toBe("id-51");
    expect(result.current.items[9].id).toBe("id-60");
    expect(result.current.totalPages).toBe(8);
  });

  it("reaches the last partial page (records 71-75)", async () => {
    const { result } = renderHook(
      () => usePaginatedFakeRows({ queryKey: ["fake"], table: "artistas", page: 8, pageSize: 10 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(5);
    expect(result.current.items[4].id).toBe("id-75");
  });

  it("refetches when the page changes (queryKey includes page)", async () => {
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => usePaginatedFakeRows({ queryKey: ["fake"], table: "artistas", page, pageSize: 10 }),
      { wrapper: createWrapper(), initialProps: { page: 1 } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items[0].id).toBe("id-1");

    rerender({ page: 2 });
    await waitFor(() => expect(result.current.items[0]?.id).toBe("id-11"));

    expect(mockedListPaged).toHaveBeenCalledTimes(2);
  });

  it("passes search under the configured searchParam and narrows the results", async () => {
    const { result } = renderHook(
      () => usePaginatedFakeRows({ queryKey: ["fake"], table: "artistas", page: 1, pageSize: 10, search: "Registro 7" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledOptions = mockedListPaged.mock.calls[0][1] as { filters?: Record<string, unknown> };
    expect(calledOptions.filters?.search).toBe("Registro 7");
    // "Registro 7" casa com "Registro 7" e "Registro 7x" (70-75) via includes — confirma que o filtro chegou ao backend fake.
    expect(result.current.total).toBeGreaterThan(0);
    expect(result.current.total).toBeLessThan(75);
  });

  it("extra filters (e.g. status) reach the backend and may empty the result without breaking pagination", async () => {
    const { result } = renderHook(
      () => usePaginatedFakeRows({ queryKey: ["fake"], table: "artistas", page: 1, pageSize: 10, filters: { status: "ativo" } }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.total).toBe(0);
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalPages).toBe(1);
  });

  it("produces different queryKeys for different filters (no cache reuse across filters)", async () => {
    const { result, rerender } = renderHook(
      ({ filters }: { filters: Record<string, unknown> }) =>
        usePaginatedFakeRows({ queryKey: ["fake"], table: "artistas", page: 1, pageSize: 10, filters }),
      { wrapper: createWrapper(), initialProps: { filters: {} } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.total).toBe(75);

    rerender({ filters: { status: "ativo" } });
    await waitFor(() => expect(result.current.total).toBe(0));

    expect(mockedListPaged).toHaveBeenCalledTimes(2);
  });

  it("forwards the React Query AbortSignal to storage.listPaged", async () => {
    const { result } = renderHook(
      () => usePaginatedFakeRows({ queryKey: ["fake"], table: "artistas", page: 1, pageSize: 10 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledOptions = mockedListPaged.mock.calls[0][1] as { signal?: AbortSignal };
    expect(calledOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not fetch when enabled=false", async () => {
    renderHook(
      () => usePaginatedFakeRows({ queryKey: ["fake"], table: "artistas", page: 1, pageSize: 10, enabled: false }),
      { wrapper: createWrapper() },
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(mockedListPaged).not.toHaveBeenCalled();
  });
});
