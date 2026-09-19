import { storage } from "@/shared/lib/storage";

export const inventoryService = {
  async list() { return storage.list("inventario"); },
  async findById(id: string) { return storage.findById("inventario", id); },
  async create(data: Record<string, unknown>) { return storage.create("inventario", data as never); },
  async update(id: string, data: Record<string, unknown>) { return storage.update("inventario", id, data); },
  async delete(id: string) { return storage.delete("inventario", id); },
  async listByCategory(category: string) {
    return storage.list("inventario", { filters: { category } });
  },
  async listLowStock(threshold = 5) {
    const items = await storage.list<{ id: string; quantidade: number }>("inventario");
    return items.filter((i) => (i.quantidade ?? 0) <= threshold);
  },
};
