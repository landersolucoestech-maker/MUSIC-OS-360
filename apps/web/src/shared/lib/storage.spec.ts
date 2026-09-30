import type { StorageTable } from "./api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("./api-client", () => ({
  api: apiMock,
  TABLE_ENDPOINT: { items: "/items" },
  PENDING_TABLES: {},
}));

import { storage } from "./storage";

describe("storage.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves array responses", async () => {
    apiMock.get.mockResolvedValueOnce([{ id: "1", name: "Item" }]);

    await expect(storage.list("items" as StorageTable)).resolves.toEqual([
      { id: "1", name: "Item" },
    ]);
  });

  it("unwraps the paginated envelope returned by the controllers", async () => {
    apiMock.get.mockResolvedValueOnce({
      data: [{ id: "1", name: "Item" }],
      meta: { total: 1, limit: 50, offset: 0 },
    });

    await expect(storage.list("items" as StorageTable)).resolves.toEqual([
      { id: "1", name: "Item" },
    ]);
  });

  it("fails explicitly for an invalid response contract", async () => {
    apiMock.get.mockResolvedValueOnce({ meta: { total: 0 } });

    await expect(storage.list("items" as StorageTable)).rejects.toThrow(
      'Invalid list response for "items"',
    );
  });
});
