import { describe, it, expect } from "vitest";
import { normalizeUserStatus, userStatusLabel } from "./user-status";

describe("user status legacy aliases", () => {
  it.each([
    ["pendente", "invited"],
    ["ativo", "active"],
    ["inativo", "inactive"],
    ["suspenso", "suspended"],
    [" Pendente ", "invited"],
    ["invited", "invited"],
  ])("normalizes %j to %s", (input, canonical) => {
    expect(normalizeUserStatus(input)).toBe(canonical);
    expect(userStatusLabel(input)).toBe(userStatusLabel(canonical));
  });

  it.each([
    ["ativo", "active"],
    ["inativo", "inactive"],
    ["suspenso", "suspended"],
    ["pendente", "invited"],
  ] as const)("a stored legacy value %j resolves to %s even when the fallback differs", (legacy, canonical) => {
    const fallback = canonical === "suspended" ? "inactive" : "suspended";
    expect(normalizeUserStatus(legacy, fallback)).toBe(canonical);
  });

  it("falls back for unknown or non-string values", () => {
    expect(normalizeUserStatus("bogus", "inactive")).toBe("inactive");
    expect(normalizeUserStatus(42)).toBe("active");
  });
});
