import { storage } from "@/shared/lib/storage";

export const rhService = {
  async listEmployees() { return storage.list("funcionarios"); },
  async findEmployee(id: string) { return storage.findById("funcionarios", id); },
  async createEmployee(data: Record<string, unknown>) {
    return storage.create("funcionarios", data as never);
  },
  async updateEmployee(id: string, data: Record<string, unknown>) {
    return storage.update("funcionarios", id, data);
  },
  async deleteEmployee(id: string) { return storage.delete("funcionarios", id); },

  async listPayroll() { return storage.list("folha_pagamento"); },
  async createPayroll(data: Record<string, unknown>) {
    return storage.create("folha_pagamento", data as never);
  },

  async listLeaves() { return storage.list("afastamentos"); },
  async createLeave(data: Record<string, unknown>) {
    return storage.create("afastamentos", data as never);
  },
  async updateLeave(id: string, data: Record<string, unknown>) {
    return storage.update("afastamentos", id, data);
  },
};
