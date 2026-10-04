import { describe, expect, it } from "vitest";
import { mergeAudioLyricsInsights } from "./mergeAudioLyricsInsights";
import type { TrackAudioAnalysis, TrackLyricsAnalysis } from "./types";

const lyrics = {
  status: "completed", provider: "local", mainTheme: "tema", secondaryThemes: [], sentiment: "melancholic",
  hooks: [], viralPhrases: [], keywords: [], editorialTags: [], missingData: [],
} as TrackLyricsAnalysis;

function audio(mood: string | undefined): TrackAudioAnalysis {
  return { status: "completed", provider: "local", energy: "high", mood, missingData: [] };
}

describe("mergeAudioLyricsInsights pending sentinel wiring", () => {
  it("keeps a real mood and lists it as a differentiator", () => {
    const result = mergeAudioLyricsInsights(audio("dançante"), lyrics);
    expect(result.mood).toBe("dançante");
    expect(result.differentiators).toContain("Mood sonoro: dançante");
  });

  it.each(["pending", "pendente"])("treats %s as missing: falls back to lyrics sentiment, no differentiator", (token) => {
    const result = mergeAudioLyricsInsights(audio(token), lyrics);
    expect(result.mood).toBe("melancólico");
    expect(result.differentiators.some((d) => d.startsWith("Mood sonoro"))).toBe(false);
  });

  it("falls back to the pending sentinel when there is no mood and no sentiment", () => {
    const result = mergeAudioLyricsInsights(audio(undefined), { ...lyrics, sentiment: undefined });
    expect(result.mood).toBe("pending");
  });
});
