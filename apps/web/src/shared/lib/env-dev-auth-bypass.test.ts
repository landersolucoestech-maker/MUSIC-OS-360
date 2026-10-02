import { describe, expect, it } from "vitest";
import { deriveDevAuthBypass } from "./env";

describe("deriveDevAuthBypass (VITE_DEV_AUTH_BYPASS — DEV ONLY)", () => {
  it("never activates outside a development build, even with a misconfigured flag (staging/production)", () => {
    expect(deriveDevAuthBypass(false, "true")).toBe(false);
  });

  it("does not activate in dev when the flag is absent, false, or anything other than exactly 'true'", () => {
    expect(deriveDevAuthBypass(true, undefined)).toBe(false);
    expect(deriveDevAuthBypass(true, "false")).toBe(false);
    expect(deriveDevAuthBypass(true, "1")).toBe(false);
    expect(deriveDevAuthBypass(true, "")).toBe(false);
  });

  it("activates only when dev AND the flag is exactly 'true'", () => {
    expect(deriveDevAuthBypass(true, "true")).toBe(true);
  });
});
