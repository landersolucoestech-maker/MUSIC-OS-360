import { storage } from "@/shared/lib/storage";

export const catalogService = {
  async listWorks() {
    return storage.list("works");
  },

  async getWork(id: string) {
    return storage.findById("works", id);
  },

  async createWork(data: Record<string, unknown>) {
    return storage.create("works", data as never);
  },

  async updateWork(id: string, patch: Record<string, unknown>) {
    return storage.update("works", id, patch);
  },

  async deleteWork(id: string) {
    return storage.delete("works", id);
  },

  async listPhonograms() {
    return storage.list("phonograms");
  },

  async getPhonogram(id: string) {
    return storage.findById("phonograms", id);
  },

  async createPhonogram(data: Record<string, unknown>) {
    return storage.create("phonograms", data as never);
  },

  async updatePhonogram(id: string, patch: Record<string, unknown>) {
    return storage.update("phonograms", id, patch);
  },

  async deletePhonogram(id: string) {
    return storage.delete("phonograms", id);
  },

  async searchWorks(q: string) {
    const all = await storage.list<{ id: string; title: string }>("works");
    const lower = q.toLowerCase();
    return all.filter((w) => (w.title ?? "").toLowerCase().includes(lower));
  },
};
