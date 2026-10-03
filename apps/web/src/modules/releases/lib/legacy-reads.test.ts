import { describe, expect, it } from "vitest";
import { creditName, holderPercentage, projectLabel, projectTracksForRelease, trackArtist, trackTitle } from "./legacy-reads";

describe("releases legacy reads: canonical first, deprecated only as a fallback", () => {
  it("creditName: name wins over nome; plain strings pass through", () => {
    expect(creditName({ name: "A", nome: "B" })).toBe("A");
    expect(creditName({ nome: "B" })).toBe("B");
    expect(creditName({})).toBe("");
    expect(creditName("  Plain ")).toBe("Plain");
    expect(creditName(null)).toBe("");
  });

  it("trackTitle: title wins over titulo, then the position label", () => {
    expect(trackTitle({ title: "T", titulo: "L" }, 1)).toBe("T");
    expect(trackTitle({ titulo: "L" }, 1)).toBe("L");
    expect(trackTitle({ title: "", titulo: "" }, 3)).toBe("Faixa 3");
  });

  it("trackArtist: artist wins over artista; an empty canonical value is kept", () => {
    expect(trackArtist({ artist: "A", artista: "B" })).toBe("A");
    expect(trackArtist({ artista: "B" })).toBe("B");
    expect(trackArtist({ artist: "", artista: "B" })).toBe("");
    expect(trackArtist({})).toBeUndefined();
  });

  it("holderPercentage: percentage wins over percentual, including a canonical 0", () => {
    expect(holderPercentage({ percentage: 40, percentual: 10 })).toBe(40);
    expect(holderPercentage({ percentage: 0, percentual: 10 })).toBe(0);
    expect(holderPercentage({ percentual: 10 })).toBe(10);
    expect(holderPercentage({})).toBeUndefined();
  });

  it("projectLabel: title wins over nome", () => {
    expect(projectLabel({ title: "T", nome: "N" })).toBe("T");
    expect(projectLabel({ nome: "N" })).toBe("N");
    expect(projectLabel(null)).toBe("");
  });

  it("projectTracksForRelease: the hydrated tracks win and the deprecated description JSON is ignored when they exist", () => {
    const out = projectTracksForRelease({ tracks: [{ name: "Canonical", composers: ["c"], producers: ["p"], lyrics: "l" }], description: JSON.stringify([{ nome: "Legacy" }]) });
    expect(out).toEqual([{ title: "Canonical", composers: ["c"], producers: ["p"], lyrics: "l", isrc: "" }]);
  });

  it("projectTracksForRelease: without tracks the deprecated JSON copy is read (canonical keys first inside it)", () => {
    const out = projectTracksForRelease({ tracks: [], description: JSON.stringify([{ nome: "L1", compositores: ["x"], produtores: ["y"], letra: "z", isrc: "BR1" }, { name: "N2", nome: "ignored", composers: ["k"] }]) });
    expect(out[0]).toEqual({ title: "L1", composers: ["x"], producers: ["y"], lyrics: "z", isrc: "BR1" });
    expect(out[1]).toMatchObject({ title: "N2", composers: ["k"] });
  });

  it("projectTracksForRelease: invalid or non-array description yields no tracks", () => {
    expect(projectTracksForRelease({ description: "not json" })).toEqual([]);
    expect(projectTracksForRelease({ description: "{}" })).toEqual([]);
    expect(projectTracksForRelease({})).toEqual([]);
  });
});
