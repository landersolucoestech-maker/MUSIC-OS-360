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

// Regressão: QueryTransactionDto (apps/api) marca "artistId" como alias legado NUNCA lido pelo
// service (Swagger deprecated: "não lido pelo service. Use artist_id") — o campo real é
// "artist_id". Enviar "artistId" passava no whitelist do ValidationPipe (não dava 400) mas o
// filtro era silenciosamente ignorado: a API respondia 200 com TODAS as transações do tenant,
// não só as do artista — pior que um 400, porque não havia nenhum sinal de erro. Isso quebrava
// a aba Financeiro do modal Visão 360° do artista.
describe("useTransactions", () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedList.mockResolvedValue([]);
  });

  it("filtra por artist_id (não artistId) ao buscar transações de um artista", async () => {
    renderHook(() => useTransactions(true, "artist-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    const [, options] = mockedList.mock.calls[0]!;
    expect(options?.filters).toEqual({ artist_id: "artist-1" });
    expect(options?.filters).not.toHaveProperty("artistId");
  });

  it("sem artistId, não aplica filtro de artista", async () => {
    renderHook(() => useTransactions(true), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedList).toHaveBeenCalled());
    const [, options] = mockedList.mock.calls[0]!;
    expect(options?.filters).toBeUndefined();
  });
});
