import { afterEach, describe, expect, it, vi } from "vitest";

import { api, setAccessToken, setTenantId } from "./api-client";
import { PasswordChangeRequiredError, TenantError } from "./errors";

function mockResponse(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("api-client response contract", () => {
  afterEach(() => {
    setAccessToken(null);
    setTenantId(null);
    vi.unstubAllGlobals();
  });

  it("unwraps an object payload", async () => {
    mockResponse({
      data: { entities: [{ name: "artists" }] },
      timestamp: "2026-06-19T00:00:00.000Z",
    });

    await expect(
      api.get<{ entities: Array<{ name: string }> }>("/reports/entities"),
    ).resolves.toEqual({ entities: [{ name: "artists" }] });
  });

  it("unwraps an array payload", async () => {
    mockResponse({
      data: [{ entity: "artists" }, { entity: "contracts" }],
      timestamp: "2026-06-19T00:00:00.000Z",
    });

    await expect(
      api.get<Array<{ entity: string }>>("/reports/definitions"),
    ).resolves.toHaveLength(2);
  });

  it("returns the data array from a paginated HTTP response", async () => {
    mockResponse({
      data: [{ id: "ticket-1" }],
      meta: { total: 1, offset: 0, limit: 200 },
      timestamp: "2026-06-19T00:00:00.000Z",
    });

    await expect(
      api.get<Array<{ id: string }>>("/support-tickets?limit=200"),
    ).resolves.toEqual([{ id: "ticket-1" }]);
  });

  it("returns undefined for an empty response", async () => {
    mockResponse(undefined, 204);

    await expect(api.delete("/financial-categories/category-1")).resolves.toBeUndefined();
  });

  it("maps a 403 MUST_CHANGE_PASSWORD body to PasswordChangeRequiredError (Part 74)", async () => {
    mockResponse({ statusCode: 403, error: "MUST_CHANGE_PASSWORD", message: "Troca de senha obrigatória." }, 403);

    await expect(api.get("/artists")).rejects.toBeInstanceOf(PasswordChangeRequiredError);
  });

  it("maps any other 403 body to the generic TenantError (unchanged behavior)", async () => {
    mockResponse({ statusCode: 403, error: "TENANT_SUSPENDED", message: "Tenant suspenso." }, 403);

    await expect(api.get("/artists")).rejects.toBeInstanceOf(TenantError);
  });
});
