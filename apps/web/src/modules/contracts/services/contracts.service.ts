import { storage } from "@/shared/lib/storage";

const JSON_FIELDS = ["participants", "variables", "music_work", "signature_settings", "branding_settings"] as const;

function serializeJsonFields(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const field of JSON_FIELDS) {
    if (out[field] != null && typeof out[field] !== "string") {
      out[field] = JSON.stringify(out[field]);
    }
  }
  return out;
}

export const contractsService = {
  async list() {
    return storage.list("contracts");
  },

  async getById(id: string) {
    return storage.findById("contracts", id);
  },

  async create(data: Record<string, unknown>) {
    return storage.create("contracts", data as never);
  },

  async update(id: string, patch: Record<string, unknown>) {
    return storage.update("contracts", id, patch);
  },

  async delete(id: string) {
    return storage.delete("contracts", id);
  },

  async listByStatus(status: string) {
    return storage.list("contracts", { filters: { status } });
  },

  async listExpiringSoon(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const all = await storage.list<{ id: string; end_date: string; status: string }>("contracts");
    return all.filter(
      (c) => c.status === "in_force" && new Date(c.end_date) <= cutoff,
    );
  },

  async listTemplates() {
    return storage.list("contract_templates");
  },

  async getTemplate(id: string) {
    return storage.findById("contract_templates", id);
  },

  async listContractServiceTypes() {
    return storage.list("contract_service_types");
  },

  async createContractServiceType(data: Record<string, unknown>) {
    return storage.create("contract_service_types", serializeJsonFields(data) as never);
  },

  async updateContractServiceType(id: string, patch: Record<string, unknown>) {
    return storage.update(
      "contract_service_types",
      id,
      { ...serializeJsonFields(patch), updated_at: new Date().toISOString() },
    );
  },

  async archiveContractServiceType(id: string) {
    return storage.update("contract_service_types", id, { active: false, updated_at: new Date().toISOString() });
  },
};
