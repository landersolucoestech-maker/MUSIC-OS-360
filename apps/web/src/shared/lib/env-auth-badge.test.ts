import { describe, expect, it } from "vitest";
import { deriveAuthEnvironmentLabel, deriveMaskedSupabaseRef, extractSupabaseRef } from "./env";

describe("extractSupabaseRef", () => {
  it("extracts the ref from a valid Supabase URL", () => {
    expect(extractSupabaseRef("https://rypnevnfipygyhysqpdo.supabase.co")).toBe("rypnevnfipygyhysqpdo");
  });

  it("returns null for undefined or an invalid URL", () => {
    expect(extractSupabaseRef(undefined)).toBeNull();
    expect(extractSupabaseRef("not-a-url")).toBeNull();
  });
});

describe("deriveAuthEnvironmentLabel", () => {
  it("identifies the DEV environment", () => {
    expect(deriveAuthEnvironmentLabel("https://rypnevnfipygyhysqpdo.supabase.co")).toBe("DEV");
  });

  it("identifies the STAGING environment", () => {
    expect(deriveAuthEnvironmentLabel("https://jjnnjnxjkqipgqebijen.supabase.co")).toBe("STAGING");
  });

  it("identifies the MAIN ref and flags it as forbidden", () => {
    expect(deriveAuthEnvironmentLabel("https://sxmfeocztlztvpdnxayk.supabase.co")).toBe("MAIN (proibido)");
  });

  it("returns 'desconhecido' for an unmapped ref or absent URL", () => {
    expect(deriveAuthEnvironmentLabel("https://outroref123456.supabase.co")).toBe("desconhecido");
    expect(deriveAuthEnvironmentLabel(undefined)).toBe("desconhecido");
  });
});

describe("deriveMaskedSupabaseRef", () => {
  it("masks the ref, showing only the first/last 4 characters", () => {
    expect(deriveMaskedSupabaseRef("https://rypnevnfipygyhysqpdo.supabase.co")).toBe("rypn…qpdo");
  });

  it("never includes the whole ref or the full URL", () => {
    const masked = deriveMaskedSupabaseRef("https://rypnevnfipygyhysqpdo.supabase.co");
    expect(masked).not.toContain("rypnevnfipygyhysqpdo");
  });

  it("returns a placeholder when there is no URL", () => {
    expect(deriveMaskedSupabaseRef(undefined)).toBe("????…????");
  });
});
