import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAllPages } from "@/shared/lib/exportAll";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, listPaged: vi.fn() } };
});

const mockedListPaged = vi.mocked(storage.listPaged);

interface FakeRow { id: string; name: string }

function fakeDataset(size: number): FakeRow[] {
  return Array.from({ length: size }, (_, i) => ({ id: `id-${i + 1}`, name: `Registro ${i + 1}` }));
}

describe("fetchAllPages", () => {
  beforeEach(() => {
    mockedListPaged.mockReset();
  });

  it("collects the 75 records via iterative pagination — does not truncate at the old cap of 50", async () => {
    const dataset = fakeDataset(75);
    mockedListPaged.mockImplementation((async (_table: string, options: { page: number; pageSize: number }) => {
      const offset = (options.page - 1) * options.pageSize;
      const items = dataset.slice(offset, offset + options.pageSize);
      return { items, page: options.page, pageSize: options.pageSize, total: dataset.length, totalPages: Math.ceil(dataset.length / options.pageSize) };
    }) as typeof storage.listPaged);

    const result = await fetchAllPages<FakeRow>("artists", { pageSize: 20 });

    expect(result.total).toBe(75);
    expect(result.items).toHaveLength(75);
    expect(result.items.map((i) => i.id)).toContain("id-75");
    expect(result.truncated).toBe(false);
    // 75 records / 20 per page = 4 calls (20+20+20+15).
    expect(mockedListPaged).toHaveBeenCalledTimes(4);
  });

  it("preserves the active filters on every fetched page", async () => {
    mockedListPaged.mockResolvedValue({ items: [], page: 1, pageSize: 200, total: 0, totalPages: 1 });
    await fetchAllPages<FakeRow>("events", { filters: { type: "show", status: "confirmed" } });

    const calledOptions = mockedListPaged.mock.calls[0][1] as { filters?: Record<string, unknown> };
    expect(calledOptions.filters).toEqual({ type: "show", status: "confirmed" });
  });

  it("respects the safety ceiling (maxRecords) and reports truncated:true instead of running forever", async () => {
    const dataset = fakeDataset(500);
    mockedListPaged.mockImplementation((async (_table: string, options: { page: number; pageSize: number }) => {
      const offset = (options.page - 1) * options.pageSize;
      const items = dataset.slice(offset, offset + options.pageSize);
      return { items, page: options.page, pageSize: options.pageSize, total: dataset.length, totalPages: Math.ceil(dataset.length / options.pageSize) };
    }) as typeof storage.listPaged);

    const result = await fetchAllPages<FakeRow>("artists", { pageSize: 100, maxRecords: 250 });

    expect(result.items.length).toBeLessThanOrEqual(250);
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(500);
  });

  it("an empty dataset returns items:[] without calling listPaged more than once", async () => {
    mockedListPaged.mockResolvedValue({ items: [], page: 1, pageSize: 200, total: 0, totalPages: 1 });
    const result = await fetchAllPages<FakeRow>("artists");
    expect(result.items).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(mockedListPaged).toHaveBeenCalledTimes(1);
  });
});
