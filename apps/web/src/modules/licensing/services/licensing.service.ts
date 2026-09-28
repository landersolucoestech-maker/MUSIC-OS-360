import { storage } from "@/shared/lib/storage";

export const licensingService = {
  async list() { return storage.list("licenses"); },
  async findById(id: string) { return storage.findById("licenses", id); },
  async create(data: Record<string, unknown>) { return storage.create("licenses", data as never); },
  async update(id: string, data: Record<string, unknown>) { return storage.update("licenses", id, data); },
  async delete(id: string) { return storage.delete("licenses", id); },
  async listByStatus(status: string) {
    return storage.list("licenses", { filters: { status } });
  },
  async listByArtist(artistId: string) {
    return storage.list("licenses", { filters: { artist_id: artistId } });
  },
  async listFinancialRules() { return storage.list("financial_rules"); },
};

