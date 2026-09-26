import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTransactions } from "./useTransactions";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, list: vi.fn() } };
});

vi.mock("@/app/providers/TenantContext", () => ({
  useTenant: () => ({ tenant: { id: "tenant-test", name: "Tenant Teste", permissions: {} } }),
}));

const mockedList = vi.mocked(storage.list);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Regression: QueryTransactionDto (apps/api) marks "artistId" as a legacy alias NEVER read by the
// service (Swagger deprecated note: it is not read by the service, use artist_id) — the real field is
// "artist_id". Sending "artistId" passed the ValidationPipe whitelist (no 400) but the
// filter was silently ignored: the API answered 200 with ALL of the tenant's transactions,
// not only the artist's — worse than a 400, because there was no error signal at all. That broke
// the finance tab of the artist's 360° View modal.
describe("useTransactions", () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedList.mockResolvedValue([]);
  });

  it("filters by artist_id (not artistId) when fetching an artist's transactions", async () => {
    renderHook(() => useTransactions(true, "artist-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    const [, options] = mockedList.mock.calls[0]!;
    expect(options?.filters).toEqual({ artist_id: "artist-1" });
    expect(options?.filters).not.toHaveProperty("artistId");
  });

  it("without artistId, applies no artist filter", async () => {
    renderHook(() => useTransactions(true), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    const [, options] = mockedList.mock.calls[0]!;
    expect(options?.filters).toBeUndefined();
  });
});
