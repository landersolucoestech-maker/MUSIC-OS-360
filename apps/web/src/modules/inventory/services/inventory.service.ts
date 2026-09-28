import { storage } from "@/shared/lib/storage";

export const inventoryService = {
  async list() { return storage.list("inventory_items"); },
  async findById(id: string) { return storage.findById("inventory_items", id); },
  async create(data: Record<string, unknown>) { return storage.create("inventory_items", data as never); },
  async update(id: string, data: Record<string, unknown>) { return storage.update("inventory_items", id, data); },
  async delete(id: string) { return storage.delete("inventory_items", id); },
  async listByCategory(category: string) {
    return storage.list("inventory_items", { filters: { category } });
  },
  async listLowStock(threshold = 5) {
    const items = await storage.list<{ id: string; quantidade: number }>("inventory_items");
    return items.filter((i) => (i.quantidade ?? 0) <= threshold);
  },
};
