import { describe, expect, it } from "vitest";
import { buildPitchingPrompt } from "./generatePitching";
import type { ReleaseContext } from "./types";

function contextWith(energy: string | undefined, sentiment: string | undefined): ReleaseContext {
  return {
    release: { id: "r1", label: "Single X" },
    artist: { id: "a1", label: "Artista Y" },
    diagnosis: {},
    lyricsAnalysis: { mainTheme: "amor", sentiment },
    audioAnalysis: { bpm: "120", key: "C", energy, mood: "calmo" },
    genre: "pop",
    subgenre: "",
    isrc: "",
    upc: "",
  } as unknown as ReleaseContext;
}

describe("buildPitchingPrompt vocabulary wiring", () => {
  it("prints display labels for canonical and legacy stored energy and sentiment tokens", () => {
    const canonical = buildPitchingPrompt(contextWith("high", "melancholic"));
    expect(canonical).toContain("energia alta;");
    expect(canonical).not.toContain("energia high");
    expect(canonical).not.toContain("sentimento melancholic");
    expect(canonical).toContain("sentimento melancólico.");

    const legacy = buildPitchingPrompt(contextWith("baixa/media", "positivo"));
    expect(legacy).toContain("energia baixa;");
    expect(legacy).not.toContain("baixa/media");
    expect(legacy).toContain("sentimento positivo.");
  });

  it("maps an English canonical sentiment to its display label", () => {
    const prompt = buildPitchingPrompt(contextWith("medium", "positive"));
    expect(prompt).toContain("energia média;");
    expect(prompt).not.toContain("sentimento positive.");
    expect(prompt).toContain("sentimento positivo.");
  });
});
