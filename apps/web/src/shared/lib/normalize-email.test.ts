import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./normalize-email";

describe("normalizeEmail", () => {
  it("converts to lowercase", () => {
    expect(normalizeEmail("Deyvisson@LanderRecords.com")).toBe("deyvisson@landerrecords.com");
  });

  it("trims leading and trailing spaces", () => {
    expect(normalizeEmail("  deyvisson@landerrecords.com  ")).toBe("deyvisson@landerrecords.com");
  });

  it("mixed case with spaces on both ends", () => {
    expect(normalizeEmail("  Deyvisson@LANDERRECORDS.com  ")).toBe("deyvisson@landerrecords.com");
  });

  it("an already normalized value stays identical", () => {
    expect(normalizeEmail("deyvisson@landerrecords.com")).toBe("deyvisson@landerrecords.com");
  });
});
