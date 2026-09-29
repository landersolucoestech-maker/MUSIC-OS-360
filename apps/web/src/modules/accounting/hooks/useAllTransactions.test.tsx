import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/shared/lib/storage", () => ({
  storage: { listPaged: vi.fn() },
}));

import { storage } from "@/shared/lib/storage";
import { allTransactionsQueryKey, truncatedTransactionsNotice, useAllTransactions } from "./useAllTransactions";
import { QUERY_KEYS } from "@/shared/lib/query-config";

const listPaged = vi.mocked(storage.listPaged);

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

function rows(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `t${from + i}`, type: "revenue", amount: "10.00" }));
}

beforeEach(() => {
  listPaged.mockReset();
});

describe("useAllTransactions — P&L data covers every page, not the API's default 50", () => {
  it("sweeps all pages until the backend total is covered", async () => {
    listPaged.mockImplementation(async (_table, { page, pageSize }) => {
      const total = 450;
      const start = (page - 1) * pageSize;
      const count = Math.max(0, Math.min(pageSize, total - start));
      return { items: rows(start, count), page, pageSize, total, totalPages: Math.ceil(total / pageSize) } as never;
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllTransactions(), { wrapper });
    await waitFor(() => expect(result.current.transactions).toHaveLength(450));
    expect(result.current.truncated).toBe(false);
    expect(result.current.total).toBe(450);
    expect(listPaged).toHaveBeenCalledTimes(3);
    expect(listPaged.mock.calls[0][0]).toBe("transactions");
  });

  it("filters server-side by artist_id for the 360° finance tab", async () => {
    listPaged.mockResolvedValue({ items: rows(0, 2), page: 1, pageSize: 200, total: 2, totalPages: 1 } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllTransactions({ artistId: "artist-1" }), { wrapper });
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));
    expect(listPaged.mock.calls[0][1]).toMatchObject({ filters: { artist_id: "artist-1" } });
  });

  it("surfaces truncation when the safety ceiling stops the sweep", async () => {
    listPaged.mockImplementation(async (_table, { page, pageSize }) =>
      ({ items: rows((page - 1) * pageSize, pageSize), page, pageSize, total: 99_999, totalPages: 500 }) as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllTransactions(), { wrapper });
    await waitFor(() => expect(result.current.truncated).toBe(true));
    expect(result.current.transactions).toHaveLength(5000);
    expect(truncatedTransactionsNotice(5000, 99_999)).toBe(
      "Os valores consideram apenas 5.000 de 99.999 transações. Refine o período ou os filtros para ver os totais completos.",
    );
  });

  it("does not fetch while disabled", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useAllTransactions({ enabled: false }), { wrapper });
    expect(listPaged).not.toHaveBeenCalled();
  });

  it("lives under QUERY_KEYS.TRANSACTIONS so mutations/realtime invalidation refresh it", async () => {
    listPaged.mockResolvedValue({ items: rows(0, 1), page: 1, pageSize: 200, total: 1, totalPages: 1 } as never);
    const { client, wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllTransactions(), { wrapper });
    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    expect(allTransactionsQueryKey().slice(0, 1)).toEqual([...QUERY_KEYS.TRANSACTIONS]);
    await client.invalidateQueries({ queryKey: [...QUERY_KEYS.TRANSACTIONS] });
    await waitFor(() => expect(listPaged).toHaveBeenCalledTimes(2));
  });

  it("a failed first load surfaces the error", async () => {
    listPaged.mockRejectedValue(new Error("boom"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllTransactions(), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.transactions).toEqual([]);
  });

  it("a failed background refetch keeps the loaded sweep instead of an error", async () => {
    listPaged.mockResolvedValueOnce({ items: rows(0, 3), page: 1, pageSize: 200, total: 3, totalPages: 1 } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllTransactions(), { wrapper });
    await waitFor(() => expect(result.current.transactions).toHaveLength(3));
    listPaged.mockRejectedValue(new Error("network"));
    await result.current.refetch();
    await waitFor(() => expect(listPaged).toHaveBeenCalledTimes(2));
    expect(result.current.error).toBeNull();
    expect(result.current.transactions).toHaveLength(3);
  });
});

