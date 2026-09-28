import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../services", () => ({
  contactsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { contactsService } from "../services";
import { useContacts } from "./useContacts";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const page = (items: unknown[], extra: { total?: number; truncated?: boolean } = {}) =>
  ({ items, total: extra.total ?? items.length, truncated: extra.truncated ?? false }) as never;

beforeEach(() => vi.clearAllMocks());

describe("useContacts — real loading/success/error states", () => {
  it("starts with isLoading=true and no error", () => {
    vi.mocked(contactsService.list).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useContacts(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.contacts).toEqual([]);
  });

  it("an empty list is a real, distinct state (not an error, not a mock)", async () => {
    vi.mocked(contactsService.list).mockResolvedValue(page([]));
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.contacts).toEqual([]);
  });

  it("success populates contacts with real data from the service", async () => {
    const rows = [{ id: "1", name: "Fulano" }] as never[];
    vi.mocked(contactsService.list).mockResolvedValue(page(rows));
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it("a network/API failure becomes an observable error state, not an empty list disguised as success", async () => {
    vi.mocked(contactsService.list).mockRejectedValue(new Error("Network failure"));
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Network failure");
  });

  it("createContact propagates the service error without creating a local contact", async () => {
    vi.mocked(contactsService.list).mockResolvedValue(page([]));
    vi.mocked(contactsService.create).mockRejectedValue(new Error("422 validation"));
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.createContact({ name: "X" } as never);
      }),
    ).rejects.toThrow("422 validation");
    expect(result.current.contacts).toEqual([]);
  });

  it("exposes the full-sweep total and the truncation flag (metrics never stop at the first page)", async () => {
    const rows = [{ id: "1", name: "Fulano", priority: "strategic", status: "active" }] as never[];
    vi.mocked(contactsService.list).mockResolvedValue(page(rows, { total: 6000, truncated: true }));
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    expect(result.current.truncated).toBe(true);
    expect(result.current.metrics.total).toBe(6000);
    expect(result.current.metrics.strategic).toBe(1);
  });

  it("does not fetch while disabled", () => {
    const { result } = renderHook(() => useContacts(false), { wrapper });
    expect(contactsService.list).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
