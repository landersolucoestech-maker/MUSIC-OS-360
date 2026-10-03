import { describe, expect, it } from "vitest";
import { legacyTitle } from "./legacy-title";

describe("legacyTitle: canonical-first read of a title-like record", () => {
  it("prefers the canonical title over the legacy titulo", () => {
    expect(legacyTitle({ title: "Canonical", titulo: "Legacy" })).toBe("Canonical");
  });
  it("falls back to the legacy titulo only when the canonical title is absent", () => {
    expect(legacyTitle({ titulo: "Legacy" })).toBe("Legacy");
    expect(legacyTitle({ title: null, titulo: "Legacy" })).toBe("Legacy");
    expect(legacyTitle({ title: undefined, titulo: "Legacy" })).toBe("Legacy");
  });
  it("keeps an empty canonical title instead of resurrecting the legacy value", () => {
    expect(legacyTitle({ title: "", titulo: "Legacy" })).toBe("");
  });
  it("returns undefined for a missing record or one with neither field", () => {
    expect(legacyTitle(null)).toBeUndefined();
    expect(legacyTitle(undefined)).toBeUndefined();
    expect(legacyTitle({})).toBeUndefined();
  });
});
