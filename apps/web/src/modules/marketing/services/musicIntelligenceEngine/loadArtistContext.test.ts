import { describe, expect, it } from "vitest";
import { loadArtistContext } from "./loadArtistContext";
import type { IntelligenceSources } from "./types";

const artist = { id: "a1", label: "Artist" };

function ctx(release: Record<string, unknown>) {
  const sources = {
    releases: [{ id: "r1", title: "Release", artist_id: "a1", ...release }],
    projects: [],
    campaigns: [],
    contents: [],
    tasks: [],
    suggestions: [],
  } as unknown as IntelligenceSources;
  return loadArtistContext(artist, sources, { works: [], phonograms: [] });
}

describe("loadArtistContext field probes", () => {
  it("collects the canonical release genre and mood", () => {
    const c = ctx({ music_genre: "pop", mood: "dark" });
    expect(c.predominantGenre).toBe("pop");
    expect(c.moods).toEqual(["dark"]);
  });

  it("no longer reads the legacy Portuguese `subgenero` release key", () => {
    expect(ctx({ subgenero: "trap" }).subgenres).toEqual([]);
  });
});
