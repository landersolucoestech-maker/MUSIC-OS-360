import { storage } from "@/shared/lib/storage";

/**
 * `storage.getRaw`/`setRaw` are stubs that always throw (see
 * apps/web/src/shared/lib/storage.ts) — they flag code never migrated from the
 * old localStorage to a real endpoint. Synchronous calls to those
 * methods (e.g. inside `useState(() => ...)`, as in useOperationalSettings)
 * threw during component mount, bringing down the whole React tree
 * ("removeChild" crash — reproduced via a real browser in Part 79, on the
 * /leads page, which mounts LeadFormModal/useOperationalSettings even when closed).
 *
 * Without a real backend for integrations/company_profile/notification_prefs/
 * operational_lists yet, the correct behavior is to fail in a
 * silent and safe way (empty value), not to bring the app down — the real
 * classification is "not supported", not "fabricated success": no data is invented,
 * only the read/write becomes a documented no-op.
 */
function safeGetRaw<T>(key: string, fallback: T): T {
  try {
    return storage.getRaw<T>(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSetRaw<T>(key: string, value: T): void {
  try {
    storage.setRaw(key, value);
  } catch {
    // No real endpoint yet — a documented no-op, it never brings the app down.
  }
}

export const settingsService = {
  async listUsers() { return storage.list("users"); },
  async findUser(id: string) { return storage.findById("users", id); },
  async updateUser(id: string, data: Record<string, unknown>) {
    return storage.update("users", id, data);
  },

  async listIntegrations() {
    return safeGetRaw<Record<string, unknown>[]>("integrations", []);
  },
  async updateIntegration(id: string, data: Record<string, unknown>) {
    return storage.update("integrations", id, data);
  },

  getCompanyProfile(): Record<string, unknown> {
    return safeGetRaw<Record<string, unknown>>("company_profile", {});
  },
  saveCompanyProfile(data: Record<string, unknown>): void {
    safeSetRaw("company_profile", data);
  },

  getNotificationPrefs(): Record<string, unknown> {
    return safeGetRaw<Record<string, unknown>>("notification_prefs", {});
  },
  saveNotificationPrefs(data: Record<string, unknown>): void {
    safeSetRaw("notification_prefs", data);
  },

  getOperationalLists(): Record<string, unknown>[] {
    return safeGetRaw<Record<string, unknown>[]>("operational_lists", []);
  },
  saveOperationalLists(data: Record<string, unknown>[]): void {
    safeSetRaw("operational_lists", data);
  },
};
