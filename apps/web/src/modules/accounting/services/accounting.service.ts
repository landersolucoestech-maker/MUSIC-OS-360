import { storage } from "@/shared/lib/storage";
import { toNumber } from "@/modules/accounting/pages/profit-and-loss-calc";
import type { Transaction } from "@/modules/accounting/types/accounting.types";

export const accountingService = {
  async listTransactions() {
    return storage.list("transactions", { orderBy: { column: "transaction_date", ascending: false } });
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
    const all = await storage.list<Pick<Transaction, "id" | "transaction_date">>("transactions");
    return all.filter((t) => t.transaction_date >= start && t.transaction_date <= end);
  },

  async getSummary() {
    const list = await storage.list<Pick<Transaction, "id" | "type" | "amount">>("transactions");
    const income = list.filter((t) => t.type === "revenue").reduce((s, t) => s + toNumber(t.amount), 0);
    const expenses = list.filter((t) => t.type === "expense").reduce((s, t) => s + toNumber(t.amount), 0);
    return { revenue: income, expenses, balance: income - expenses, total: list.length };
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
