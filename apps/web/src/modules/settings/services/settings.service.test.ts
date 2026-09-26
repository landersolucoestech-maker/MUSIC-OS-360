import { describe, it, expect, vi } from "vitest";

/**
 * settings.service.test.ts  (Part 79)
 *
 * Permanent guard: `storage.getRaw`/`setRaw` are stubs that always throw
 * (never migrated from localStorage to a real endpoint). A synchronous
 * call to `settingsService.getOperationalLists()` inside
 * `useState(() => ...)` (useOperationalSettings) brought down the whole React
 * tree when mounting ANY component using it (LeadFormModal,
 * ArtistaFormModal, ContratoWizard, etc.) — reproduced via a real browser
 * on the /leads page. The four reads may never throw; they return a
 * safe empty value instead of fabricating data or bringing the app down.
 */
vi.mock("@/shared/lib/storage", () => ({
  storage: {
    list: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    getRaw: vi.fn(() => {
      throw new Error("storage.getRaw() is unavailable; use a backend endpoint.");
    }),
    setRaw: vi.fn(() => {
      throw new Error("storage.setRaw() is unavailable; use a backend endpoint.");
    }),
  },
}));

import { settingsService } from "./settings.service";

describe("settingsService — never propagates the storage.getRaw/setRaw throw", () => {
  it("getOperationalLists() returns [] instead of throwing", () => {
    expect(settingsService.getOperationalLists()).toEqual([]);
  });

  it("getCompanyProfile() returns {} instead of throwing", () => {
    expect(settingsService.getCompanyProfile()).toEqual({});
  });

  it("getNotificationPrefs() returns {} instead of throwing", () => {
    expect(settingsService.getNotificationPrefs()).toEqual({});
  });

  it("listIntegrations() returns [] instead of throwing", async () => {
    await expect(settingsService.listIntegrations()).resolves.toEqual([]);
  });

  it("saveOperationalLists()/saveCompanyProfile()/saveNotificationPrefs() never throw", () => {
    expect(() => settingsService.saveOperationalLists([])).not.toThrow();
    expect(() => settingsService.saveCompanyProfile({})).not.toThrow();
    expect(() => settingsService.saveNotificationPrefs({})).not.toThrow();
  });
});
