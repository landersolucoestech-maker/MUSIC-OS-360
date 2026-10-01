import { describe, expect, it } from "vitest";
import { loadReleaseContext } from "./loadReleaseContext";
import type { IntelligenceSources } from "./types";

const artist = { id: "a1", label: "Artist" };
const release = { id: "r1", label: "Release" };

function ctx(record: Record<string, unknown>) {
  const sources = {
    releases: [{ id: "r1", title: "Release", artist_id: "a1", ...record }],
    projects: [],
    campaigns: [],
    contents: [],
    tasks: [],
    suggestions: [],
  } as unknown as IntelligenceSources;
  return loadReleaseContext(artist, release, sources)!;
}

describe("loadReleaseContext field probes", () => {
  it("reads the canonical English keys (top level, assets, schedule)", () => {
    const c = ctx({ subgenre: "trap", mood: "dark", references: "ref", credits: "cr", assets: { audio_master_url: "https://a/m.wav" } });
    expect(c.subgenre).toBe("trap");
    expect(c.mood).toBe("dark");
    expect(c.references).toBe("ref");
    expect(c.credits).toBe("cr");
    expect(c.audioUrl).toBe("https://a/m.wav");
  });

  it.each([
    ["subgenero", "subgenre"],
    ["clima", "mood"],
    ["atmosfera", "mood"],
    ["compositores", "credits"],
    ["produtores", "credits"],
    ["referencias", "references"],
    ["fonograma_url", "audioUrl"],
  ] as const)("no longer reads the legacy Portuguese key %s", (legacy, field) => {
    expect(ctx({ [legacy]: "x" })[field]).toBe("");
    expect(ctx({ assets: { [legacy]: "x" } })[field]).toBe("");
    expect(ctx({ schedule: { [legacy]: "x" } })[field]).toBe("");
  });
});
