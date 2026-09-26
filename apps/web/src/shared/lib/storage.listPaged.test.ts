import { describe, it, expect, vi, beforeEach } from "vitest";
import { storage } from "@/shared/lib/storage";
import { api } from "@/shared/lib/api-client";

vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/api-client")>("@/shared/lib/api-client");
  return { ...actual, api: { get: vi.fn() } };
});

const mockedGet = vi.mocked(api.get);

describe("storage.listPaged", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("computa offset a partir de page/pageSize (1-indexado)", async () => {
    mockedGet.mockResolvedValue({ data: [], meta: { total: 0 } });
    await storage.listPaged("artistas", { page: 1, pageSize: 10 });
    let url = mockedGet.mock.calls[0][0] as string;
    expect(url).toContain("offset=0");
    expect(url).toContain("limit=10");

    mockedGet.mockClear();
    await storage.listPaged("artistas", { page: 6, pageSize: 10 });
    url = mockedGet.mock.calls[0][0] as string;
    expect(url).toContain("offset=50");
    expect(url).toContain("limit=10");
  });

  it("includes search, orderBy and extra filters in the query string", async () => {
    mockedGet.mockResolvedValue({ data: [], meta: { total: 0 } });
    await storage.listPaged("artistas", {
      page: 1,
      pageSize: 20,
      filters: { status: "ativo", search: "banda" },
      orderBy: { column: "nome_artistico", ascending: true },
    });
    const url = mockedGet.mock.calls[0][0] as string;
    expect(url).toContain("status=ativo");
    expect(url).toContain("search=banda");
    expect(url).toContain("orderBy=nome_artistico");
    expect(url).toContain("ascending=true");
  });

  it("unwraps the {data, meta:{total}} envelope and uses the backend's real total", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    mockedGet.mockResolvedValue({ data: rows, meta: { total: 137, offset: 0, limit: 2 } });
    const result = await storage.listPaged("artistas", { page: 1, pageSize: 2 });
    expect(result.items).toEqual(rows);
    expect(result.total).toBe(137);
  });

  it("falls back to items.length as the total when the response is a plain array (no envelope)", async () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    mockedGet.mockResolvedValue(rows);
    const result = await storage.listPaged("artistas", { page: 1, pageSize: 50 });
    expect(result.total).toBe(3);
  });

  describe("totalPages = Math.max(1, Math.ceil(total / pageSize))", () => {
    it.each([
      [137, 50, 3],
      [100, 50, 2],
      [101, 50, 3],
      [0, 50, 1],
      [1, 50, 1],
    ])("total=%i pageSize=%i -> totalPages=%i", async (total, pageSize, expected) => {
      mockedGet.mockResolvedValue({ data: [], meta: { total } });
      const result = await storage.listPaged("artistas", { page: 1, pageSize });
      expect(result.totalPages).toBe(expected);
    });
  });

  it("propagates the AbortSignal to api.get", async () => {
    mockedGet.mockResolvedValue({ data: [], meta: { total: 0 } });
    const controller = new AbortController();
    await storage.listPaged("artistas", { page: 1, pageSize: 10, signal: controller.signal });
    const options = mockedGet.mock.calls[0][1] as { signal?: AbortSignal };
    expect(options.signal).toBe(controller.signal);
  });

  it("preserva page/pageSize pedidos no resultado", async () => {
    mockedGet.mockResolvedValue({ data: [], meta: { total: 0 } });
    const result = await storage.listPaged("artistas", { page: 4, pageSize: 25 });
    expect(result.page).toBe(4);
    expect(result.pageSize).toBe(25);
  });
});
