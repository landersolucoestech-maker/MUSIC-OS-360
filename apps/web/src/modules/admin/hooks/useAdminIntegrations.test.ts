import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { adminIntegrationsService } from "@/modules/admin/services/admin-integrations.service";

/**
 * BLOCKER 2026-08-23 — the Admin Portal's integrations tab appeared empty with 14
 * records in the database. Cause: any request failure was collapsed into an empty
 * list by the UI, so 404/403/500/network were indistinguishable from an "empty catalog".
 *
 * These tests lock in the administrative contract:
 *  - the ADMIN endpoint is distinct from the customer resolver;
 *  - the service returns the COMPLETE administrative array (draft + without adapter);
 *  - an error PROPAGATES (it does not become []), so the UI can show a real error state.
 */
describe("adminIntegrationsService — admin catalog", () => {
  beforeEach(() => vi.clearAllMocks());

  const rows = [
    {
      id: "1", providerKey: "docusign", name: "DocuSign",
      categorySlug: "signing", categoryName: "Assinatura Digital",
      connectionKind: "oauth", requiredEnv: [], publicationState: "published",
      viewAudience: { mode: "all", plans: [], tenantIds: [] },
      useAudience: { mode: "all", plans: [], tenantIds: [] },
      isCore: false, notes: null,
      technicalCapability: "implemented", capabilityEvidence: "x", publishedWithoutCapability: false,
    },
    {
      id: "2", providerKey: "clicksign", name: "Clicksign",
      categorySlug: "signing", categoryName: "Assinatura Digital",
      connectionKind: "tenant_credentials", requiredEnv: [], publicationState: "hidden",
      viewAudience: { mode: "none", plans: [], tenantIds: [] },
      useAudience: { mode: "none", plans: [], tenantIds: [] },
      isCore: false, notes: null,
      technicalCapability: "not_implemented", capabilityEvidence: null, publishedWithoutCapability: false,
    },
  ];

  it("uses the ADMIN endpoint, not the client-facing resolver", async () => {
    apiMock.get.mockResolvedValue(rows);
    await adminIntegrationsService.list();
    expect(apiMock.get).toHaveBeenCalledWith("/admin/integrations");
    // The customer resolver is another surface and must not be used here.
    expect(apiMock.get).not.toHaveBeenCalledWith("/integrations/providers");
  });

  it("returns unavailable states and providers without an adapter — the admin governs the whole catalog", async () => {
    apiMock.get.mockResolvedValue(rows);
    const result = await adminIntegrationsService.list();

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.providerKey).sort()).toEqual(["clicksign", "docusign"]);
    expect(result.find((r) => r.providerKey === "clicksign")?.publicationState).toBe("hidden");
    expect(result.find((r) => r.providerKey === "clicksign")?.technicalCapability).toBe("not_implemented");
  });

  it("does not unwrap the envelope twice: api.get already resolves payload.data (a real bug in this repo)", async () => {
    // The REAL shape the api-client delivers: a plain array, not { data: [...] }.
    apiMock.get.mockResolvedValue(rows);
    await expect(adminIntegrationsService.list()).resolves.toHaveLength(2);
  });

  it("PROPAGATES the error instead of returning an empty list (404/403/500 ≠ empty catalog)", async () => {
    const failure = Object.assign(new Error("Not Found"), { statusCode: 404 });
    apiMock.get.mockRejectedValue(failure);

    // If the service swallowed the error and returned [], the UI would show
    // "no integrations" — exactly the reported blocker.
    await expect(adminIntegrationsService.list()).rejects.toThrow("Not Found");
  });

  it("update usa PATCH no recurso administrativo correto", async () => {
    apiMock.patch.mockResolvedValue(rows[0]);
    await adminIntegrationsService.update("1", { publicationState: "hidden" });
    expect(apiMock.patch).toHaveBeenCalledWith("/admin/integrations/1", { publicationState: "hidden" });
  });
});
