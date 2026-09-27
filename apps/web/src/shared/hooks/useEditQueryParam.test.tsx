import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useEditQueryParam } from "@/shared/hooks/useEditQueryParam";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, findById: vi.fn() } };
});

const mockedFindById = vi.mocked(storage.findById);

interface FakeRow { id: string; nome: string }

function wrapperFor(initialEntry: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
}

describe("useEditQueryParam", () => {
  beforeEach(() => {
    mockedFindById.mockReset();
  });

  it("resolves by id when the record is already in the loaded list (original behavior preserved)", async () => {
    const items: FakeRow[] = [{ id: "id-1", nome: "Um" }, { id: "id-2", nome: "Dois" }];
    const onMatch = vi.fn();
    renderHook(() => useEditQueryParam("edit", items, onMatch, "artistas"), {
      wrapper: wrapperFor("/artists?edit=id-2"),
    });

    await waitFor(() => expect(onMatch).toHaveBeenCalledWith(items[1]));
    expect(mockedFindById).not.toHaveBeenCalled();
  });

  it("record #75 outside the loaded list (capped at 50) resolves via a direct ID lookup when `table` is passed", async () => {
    // Simulates the "give me everything" list stuck at the tenant's first 50 records.
    const items: FakeRow[] = Array.from({ length: 50 }, (_, i) => ({ id: `id-${i + 1}`, nome: `Registro ${i + 1}` }));
    mockedFindById.mockResolvedValue({ id: "id-75", nome: "Registro 75" });
    const onMatch = vi.fn();

    renderHook(() => useEditQueryParam("edit", items, onMatch, "artistas"), {
      wrapper: wrapperFor("/artists?edit=id-75"),
    });

    await waitFor(() => expect(onMatch).toHaveBeenCalledWith({ id: "id-75", nome: "Registro 75" }));
    expect(mockedFindById).toHaveBeenCalledWith("artistas", "id-75");
  });

  it("without `table`, keeps the old behavior: does not resolve records outside the loaded list", async () => {
    const items: FakeRow[] = Array.from({ length: 50 }, (_, i) => ({ id: `id-${i + 1}`, nome: `Registro ${i + 1}` }));
    const onMatch = vi.fn();

    renderHook(() => useEditQueryParam("edit", items, onMatch), {
      wrapper: wrapperFor("/artists?edit=id-75"),
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(onMatch).not.toHaveBeenCalled();
    expect(mockedFindById).not.toHaveBeenCalled();
  });

  it("without a URL parameter, fetches nothing", async () => {
    const onMatch = vi.fn();
    renderHook(() => useEditQueryParam("edit", [], onMatch, "artistas"), {
      wrapper: wrapperFor("/artists"),
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(onMatch).not.toHaveBeenCalled();
    expect(mockedFindById).not.toHaveBeenCalled();
  });
});
