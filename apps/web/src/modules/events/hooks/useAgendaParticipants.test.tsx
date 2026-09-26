import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAgendaParticipants } from "@/modules/events/hooks/useAgendaParticipants";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, listPaged: vi.fn(), findById: vi.fn() } };
});

// Task J: useAgendaParticipants não deve mais depender de useArtistas()/
// useFuncionarios() (capadas a 50/tenant) — usuarios/contacts ficam fora do
// escopo desta migração, mockados vazios para isolar o teste.
vi.mock("@/modules/settings/hooks/useUsuarios", () => ({ useUsuarios: () => ({ usuarios: [] }) }));
vi.mock("@/modules/crm-relationships/hooks/useContacts", () => ({ useContacts: () => ({ contacts: [] }) }));

const mockedListPaged = vi.mocked(storage.listPaged);
const mockedFindById = vi.mocked(storage.findById);

interface FakeArtist { id: string; nome_artistico: string }

// 75 artistas — mais que o antigo cap de 50/tenant.
const ARTISTS: FakeArtist[] = Array.from({ length: 75 }, (_, i) => ({
  id: `artist-${i + 1}`,
  nome_artistico: `Artista ${i + 1}`,
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const settle = (ms = 350) => new Promise((r) => setTimeout(r, ms));

describe("useAgendaParticipants", () => {
  beforeEach(() => {
    mockedListPaged.mockReset();
    mockedFindById.mockReset();
    mockedListPaged.mockImplementation((async (table: string, options: { page: number; pageSize: number; filters?: Record<string, unknown> }) => {
      if (table !== "artistas") {
        return { items: [], page: 1, pageSize: options.pageSize, total: 0, totalPages: 1 };
      }
      const search = (options.filters?.search as string | undefined)?.toLowerCase();
      const rows = search ? ARTISTS.filter((a) => a.nome_artistico.toLowerCase().includes(search)) : ARTISTS.slice(0, options.pageSize);
      return { items: rows.slice(0, options.pageSize), page: 1, pageSize: options.pageSize, total: rows.length, totalPages: 1 };
    }) as typeof storage.listPaged);
  });

  it("real search: finds artist #75 (beyond the old cap of 50) by typing the name", async () => {
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) => useAgendaParticipants(search),
      { wrapper: createWrapper(), initialProps: { search: "" } },
    );

    rerender({ search: "Artista 75" });
    await waitFor(
      () => expect(result.current.participants.some((p) => p.source === "artist" && p.id === "artist-75")).toBe(true),
      { timeout: 2000 },
    );
  });

  it("pendingArtistId: resolves the legacy artist linked to the event even outside the default page, without typing a search", async () => {
    mockedFindById.mockResolvedValue({ id: "artist-75", nome_artistico: "Artista 75" });

    const { result } = renderHook(() => useAgendaParticipants("", "artist-75"), { wrapper: createWrapper() });

    await waitFor(
      () => expect(result.current.getArtistParticipantById("artist-75")?.label).toBe("Artista 75"),
      { timeout: 2000 },
    );
    expect(mockedFindById).toHaveBeenCalledWith("artistas", "artist-75");
  });

  it("without pendingArtistId, does not call findById", async () => {
    renderHook(() => useAgendaParticipants(""), { wrapper: createWrapper() });
    await settle();
    expect(mockedFindById).not.toHaveBeenCalled();
  });
});
