import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTransactions } from "./useTransactions";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, list: vi.fn(), listPaged: vi.fn() } };
});

vi.mock("@/app/providers/TenantContext", () => ({
  useTenant: () => ({ tenant: { id: "tenant-test", name: "Tenant Teste", permissions: {} } }),
}));

const mockedList = vi.mocked(storage.list);
const mockedListPaged = vi.mocked(storage.listPaged);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function rows(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `t${from + i}`, type: "revenue", amount: "10.00" }));
}

function serve(total: number) {
  mockedListPaged.mockImplementation(async (_table, { page, pageSize }) => {
    const start = (page - 1) * pageSize;
    const count = Math.max(0, Math.min(pageSize, total - start));
    return { items: rows(start, count), page, pageSize, total, totalPages: Math.ceil(total / pageSize) } as never;
  });
}

// find-85dfc055: a plain storage.list sends no limit, so the API answered its default page (50) and
// every total computed from the hook covered only the 50 newest transactions.
describe("useTransactions — the list is the complete sweep, never the API's default page", () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedListPaged.mockReset();
    serve(0);
  });

  it("returns every transaction past the API default page of 50 (and never calls the unpaged list)", async () => {
    serve(450);
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.transactions).toHaveLength(450));
    expect(result.current.total).toBe(450);
    expect(result.current.truncated).toBe(false);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("flags truncation explicitly when the safety ceiling stops the sweep (never a silent cut)", async () => {
    mockedListPaged.mockImplementation(async (_table, { page, pageSize }) =>
      ({ items: rows((page - 1) * pageSize, pageSize), page, pageSize, total: 99_999, totalPages: 500 }) as never);
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.truncated).toBe(true));
    expect(result.current.total).toBe(99_999);
    expect(result.current.transactions.length).toBeLessThan(99_999);
  });

  it("filters by artist_id (not artistId) when fetching an artist's transactions", async () => {
    renderHook(() => useTransactions(true, "artist-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedListPaged).toHaveBeenCalled());
    const [, options] = mockedListPaged.mock.calls[0]!;
    expect(options?.filters).toEqual({ artist_id: "artist-1" });
    expect(options?.filters).not.toHaveProperty("artistId");
  });

  it("orders by the canonical transaction_date column (the legacy \"data\" column is gone)", async () => {
    renderHook(() => useTransactions(true), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedListPaged).toHaveBeenCalled());
    const [, options] = mockedListPaged.mock.calls[0]!;
    expect(options?.orderBy).toEqual({ column: "transaction_date", ascending: false });
  });

  it("without artistId, applies no artist filter", async () => {
    renderHook(() => useTransactions(true), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedListPaged).toHaveBeenCalled());
    const [, options] = mockedListPaged.mock.calls[0]!;
    expect(options?.filters).toBeUndefined();
  });

  it("mutations-only callers (enabled=false) run no list request at all", async () => {
    const { result } = renderHook(() => useTransactions(false), { wrapper: createWrapper() });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockedListPaged).not.toHaveBeenCalled();
    expect(mockedList).not.toHaveBeenCalled();
    expect(result.current.transactions).toEqual([]);
    expect(typeof result.current.addTransaction.mutateAsync).toBe("function");
    expect(typeof result.current.deleteTransaction.mutateAsync).toBe("function");
  });
});
