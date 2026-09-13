import { storage } from "@/shared/lib/storage";

export const accountingService = {
  async listTransactions() {
    return storage.list("transactions", { orderBy: { column: "data", ascending: false } });
  },

  async getTransaction(id: string) {
    return storage.findById("transactions", id);
  },

  async createTransaction(data: Record<string, unknown>) {
    return storage.create("transactions", data as never);
  },

  async updateTransaction(id: string, patch: Record<string, unknown>) {
    return storage.update("transactions", id, patch);
  },

  async deleteTransaction(id: string) {
    return storage.delete("transactions", id);
  },

  async listByPeriod(start: string, end: string) {
    const all = await storage.list<{ id: string; data: string }>("transactions");
    return all.filter((t) => t.data >= start && t.data <= end);
  },

  async getSummary() {
    const list = await storage.list<{ id: string; type: string; valor: number }>("transactions");
    const receitas = list.filter((t) => t.type === "receita").reduce((s, t) => s + (t.valor ?? 0), 0);
    const despesas = list.filter((t) => t.type === "despesa").reduce((s, t) => s + (t.valor ?? 0), 0);
    return { receitas, despesas, saldo: receitas - despesas, total: list.length };
  },

  async listInvoices() {
    return storage.list("invoices");
  },

  async getInvoice(id: string) {
    return storage.findById("invoices", id);
  },

  async createInvoice(data: Record<string, unknown>) {
    return storage.create("invoices", data as never);
  },

  async updateInvoice(id: string, patch: Record<string, unknown>) {
    return storage.update("invoices", id, patch);
  },
};
