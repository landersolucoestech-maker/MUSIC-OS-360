// Wiring test: normalizeToBackendType resolves a pre-OL1 operational slug through the shared
// operational vocabulary (canonicalOperationalSlug) before looking it up in the granular map.
import { describe, expect, it } from "vitest";
import { normalizeToBackendType } from "./event-type";

const L = (...p: string[]) => p.join("");

describe("normalizeToBackendType legacy operational slug wiring", () => {
  it("a pre-OL1 slug resolves to the canonical entry of the granular map", () => {
    expect(normalizeToBackendType(L("reu", "nioes"), { meetings: "meeting" })).toBe("meeting");
    expect(normalizeToBackendType(`  ${L("SESSOES", "_ESTUDIO")} `, { studio_sessions: "recording" })).toBe("recording");
    expect(normalizeToBackendType(L("ensa", "ios"), { rehearsals: "tour" })).toBe("tour");
  });

  it("negative: a legacy slug absent from the map, an unknown slug and empty input fall back to other", () => {
    expect(normalizeToBackendType(L("reu", "nioes"), {})).toBe("other");
    expect(normalizeToBackendType(L("reu", "nioes"), { shows: "show" })).toBe("other");
    expect(normalizeToBackendType("not_a_known_slug", { meetings: "meeting" })).toBe("other");
    expect(normalizeToBackendType("", { meetings: "meeting" })).toBe("other");
    expect(normalizeToBackendType(null, { meetings: "meeting" })).toBe("other");
  });

  it("a coarse backend enum value and a canonical slug keep working", () => {
    expect(normalizeToBackendType("Tour", {})).toBe("tour");
    expect(normalizeToBackendType("meetings", { meetings: "interview" })).toBe("interview");
  });
});
