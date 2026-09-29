import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useScheduleParticipants } from "@/modules/events/hooks/useScheduleParticipants";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, listPaged: vi.fn(), findById: vi.fn() } };
});

// Task J: useScheduleParticipants must no longer depend on useArtistas()/
// useFuncionarios() (capped at 50/tenant) — usuarios/contacts are outside the
// scope of this migration, mocked empty to isolate the test.
vi.mock("@/modules/settings/hooks/useUsers", () => ({ useUsers: () => ({ users: [] }) }));
vi.mock("@/modules/crm-relationships/hooks/useContacts", () => ({ useContacts: () => ({ contacts: [] }) }));

const mockedListPaged = vi.mocked(storage.listPaged);
const mockedFindById = vi.mocked(storage.findById);

interface FakeArtist { id: string; stage_name: string }

// 75 artists — more than the old 50/tenant cap.
const ARTISTS: FakeArtist[] = Array.from({ length: 75 }, (_, i) => ({
  id: `artist-${i + 1}`,
  stage_name: `Artista ${i + 1}`,
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const settle = (ms = 350) => new Promise((r) => setTimeout(r, ms));

describe("useScheduleParticipants", () => {
  beforeEach(() => {
    mockedListPaged.mockReset();
    mockedFindById.mockReset();
    mockedListPaged.mockImplementation((async (table: string, options: { page: number; pageSize: number; filters?: Record<string, unknown> }) => {
      if (table !== "artists") {
        return { items: [], page: 1, pageSize: options.pageSize, total: 0, totalPages: 1 };
      }
      const search = (options.filters?.search as string | undefined)?.toLowerCase();
      const rows = search ? ARTISTS.filter((a) => a.stage_name.toLowerCase().includes(search)) : ARTISTS.slice(0, options.pageSize);
      return { items: rows.slice(0, options.pageSize), page: 1, pageSize: options.pageSize, total: rows.length, totalPages: 1 };
    }) as typeof storage.listPaged);
  });

  it("real search: finds artist #75 (beyond the old cap of 50) by typing the name", async () => {
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) => useScheduleParticipants(search),
      { wrapper: createWrapper(), initialProps: { search: "" } },
    );

    rerender({ search: "Artista 75" });
    await waitFor(
      () => expect(result.current.participants.some((p) => p.source === "artist" && p.id === "artist-75")).toBe(true),
      { timeout: 2000 },
    );
  });

  it("pendingArtistId: resolves the legacy artist linked to the event even outside the default page, without typing a search", async () => {
    mockedFindById.mockResolvedValue({ id: "artist-75", stage_name: "Artista 75" });

    const { result } = renderHook(() => useScheduleParticipants("", "artist-75"), { wrapper: createWrapper() });

    await waitFor(
      () => expect(result.current.getArtistParticipantById("artist-75")?.label).toBe("Artista 75"),
      { timeout: 2000 },
    );
    expect(mockedFindById).toHaveBeenCalledWith("artists", "artist-75");
  });

  it("without pendingArtistId, does not call findById", async () => {
    renderHook(() => useScheduleParticipants(""), { wrapper: createWrapper() });
    await settle();
    expect(mockedFindById).not.toHaveBeenCalled();
  });

  it("employees: reads the canonical department/phone fields and falls back to the accented PT-BR category", async () => {
    mockedListPaged.mockImplementation((async (table: string, options: { pageSize: number }) => {
      const items = table === "employees"
        ? [
          { id: "emp-1", name: "Ana", phone: "+55 11 90000-0000", department: "Financeiro" },
          { id: "emp-2", name: "Bia" },
        ]
        : [];
      return { items, page: 1, pageSize: options.pageSize, total: items.length, totalPages: 1 };
    }) as typeof storage.listPaged);

    const { result } = renderHook(() => useScheduleParticipants(""), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.participants.filter((p) => p.source === "employee")).toHaveLength(2), { timeout: 2000 });
    const [ana, bia] = result.current.participants.filter((p) => p.source === "employee");
    expect(ana).toMatchObject({ label: "Ana", phone: "+55 11 90000-0000", category: "Financeiro" });
    expect(bia.category).toBe("Funcionário");
  });
});
