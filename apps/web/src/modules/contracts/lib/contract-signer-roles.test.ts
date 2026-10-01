import { describe, expect, it } from "vitest";
import { SIGNER_ROLES, SIGNER_ROLE_LABEL, canonicalSignerRole, contractSignerSchema } from "../schemas/contract-schema";

describe("contract signer roles (R3-04)", () => {
  it("uses canonical English machine values with PT-BR labels", () => {
    expect([...SIGNER_ROLES]).toEqual(["artist", "label", "producer", "manager"]);
    expect(SIGNER_ROLE_LABEL.manager).toBe("Empresário");
    expect(SIGNER_ROLE_LABEL.artist).toBe("Artista");
  });

  it("reads legacy persisted roles and leaves anything else untouched", () => {
    expect(["artista", "produtor", "empresario", "label"].map(canonicalSignerRole)).toEqual(["artist", "producer", "manager", "label"]);
    expect(canonicalSignerRole("toString")).toBe("toString");
    expect(canonicalSignerRole(undefined)).toBeUndefined();
  });

  it("validates canonical roles only (legacy must be canonicalized by the reader first)", () => {
    expect(contractSignerSchema.safeParse({ name: "A", email: "a@b.co", role: "producer" }).success).toBe(true);
    expect(contractSignerSchema.safeParse({ name: "A", email: "a@b.co", role: "produtor" }).success).toBe(false);
  });
});
