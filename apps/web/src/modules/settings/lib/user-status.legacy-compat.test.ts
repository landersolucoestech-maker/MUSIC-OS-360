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

  it("falls back for unknown or non-string values", () => {
    expect(normalizeUserStatus("bogus", "inactive")).toBe("inactive");
    expect(normalizeUserStatus(42)).toBe("active");
  });
});
