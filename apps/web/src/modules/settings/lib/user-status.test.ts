import { describe, expect, it } from "vitest";
import { normalizeUserStatus, userStatusLabel } from "./user-status";

describe("user status vocabulary", () => {
  it("keeps canonical English values", () => {
    expect(normalizeUserStatus("active")).toBe("active");
    expect(normalizeUserStatus("suspended")).toBe("suspended");
  });
  it("reads legacy Portuguese values", () => {
    expect(normalizeUserStatus("ativo")).toBe("active");
    expect(normalizeUserStatus("Inativo")).toBe("inactive");
    expect(normalizeUserStatus("suspenso")).toBe("suspended");
  });
  it("falls back for unknown input", () => {
    expect(normalizeUserStatus(undefined)).toBe("active");
    expect(normalizeUserStatus("nope", "inactive")).toBe("inactive");
  });
  it("renders PT-BR labels", () => {
    expect(userStatusLabel("active")).toBe("Ativo");
    expect(userStatusLabel("inactive")).toBe("Inativo");
  });
});
