import { beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();
vi.mock("@/shared/lib/storage", () => ({ storage: { list: (...args: unknown[]) => listMock(...args) } }));

import { inventoryService } from "./inventory.service";

describe("inventoryService.listLowStock", () => {
  beforeEach(() => listMock.mockReset());

  it("filters on the canonical API column `quantity` (was the non-existent `quantidade`)", async () => {
    listMock.mockResolvedValue([
      { id: "a", quantity: 1 },
      { id: "b", quantity: 50 },
      { id: "c", quantity: 5 },
    ]);
    const low = await inventoryService.listLowStock(5);
    expect(low.map((i) => i.id)).toEqual(["a", "c"]);
  });
});
