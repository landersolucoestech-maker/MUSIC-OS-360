import { describe, expect, it } from "vitest";
import type { UpdateUserInput } from "./useUsers";
import { normalizeUserStatus } from "@/modules/settings/lib/user-status";

describe("UpdateUserInput.status", () => {
  it("accepts only canonical English values (legacy ativo/inativo removed from the union)", () => {
    const ok: UpdateUserInput = { id: "u", status: "inactive" };
    // @ts-expect-error legacy Portuguese status is no longer part of the input type
    const legacy: UpdateUserInput = { id: "u", status: "ativo" };
    expect(ok.status).toBe("inactive");
    expect(legacy.id).toBe("u");
  });

  it("API-side legacy values are still handled by normalizeUserStatus", () => {
    expect(normalizeUserStatus("ativo")).toBe("active");
  });
});
