import { storage } from "@/shared/lib/storage";

export const hrService = {
  async listEmployees() { return storage.list("employees"); },
  async findEmployee(id: string) { return storage.findById("employees", id); },
  async createEmployee(data: Record<string, unknown>) {
    return storage.create("employees", data as never);
  },
  async updateEmployee(id: string, data: Record<string, unknown>) {
    return storage.update("employees", id, data);
  },
  async deleteEmployee(id: string) { return storage.delete("employees", id); },

  async listPayroll() { return storage.list("payroll_entries"); },
  async createPayroll(data: Record<string, unknown>) {
    return storage.create("payroll_entries", data as never);
  },

  async listLeaves() { return storage.list("leave_requests"); },
  async createLeave(data: Record<string, unknown>) {
    return storage.create("leave_requests", data as never);
  },
  async updateLeave(id: string, data: Record<string, unknown>) {
    return storage.update("leave_requests", id, data);
  },
};
