import { describe, expect, it } from "vitest";
import { analyzeAudioDraft } from "./analyzeAudio";
import { audioLevelLabel, normalizeAudioLevel } from "./audioVocabulary";
import { mergeAudioLyricsInsights } from "./mergeAudioLyricsInsights";
import { analyzeLyricsDraft } from "./analyzeLyrics";
import type { TrackAudioAnalysis } from "./types";

const draft = (input: { mood?: string; bpm?: string }) => analyzeAudioDraft({ audioUrl: "", genre: "", subgenre: "", mood: "", bpm: "", ...input });

describe("analyzeAudioDraft machine vocabulary", () => {
  it("emits English level ids", () => {
    expect(draft({ mood: "festa", bpm: "120" }).energy).toBe("high");
    expect(draft({ mood: "triste" }).energy).toBe("low");
    expect(draft({ mood: "calmo", bpm: "80" }).energy).toBe("medium");
    expect(draft({ mood: "calmo", bpm: "80" }).danceability).toBe("medium");
    expect(draft({ mood: "calmo", bpm: "60" }).danceability).toBe("low");
  });
});

describe("audio level compat mapper", () => {
  it("reads canonical and legacy Portuguese stored tokens", () => {
    expect(normalizeAudioLevel("high")).toBe("high");
    expect(normalizeAudioLevel("alta")).toBe("high");
    expect(normalizeAudioLevel("media")).toBe("medium");
    expect(normalizeAudioLevel("Média")).toBe("medium");
    expect(normalizeAudioLevel("baixa")).toBe("low");
    expect(normalizeAudioLevel("baixa/media")).toBe("low");
    expect(normalizeAudioLevel("whatever")).toBeUndefined();
    expect(normalizeAudioLevel(undefined)).toBeUndefined();
  });

  it("renders PT-BR display copy and keeps unknown text unchanged", () => {
    expect(audioLevelLabel("high")).toBe("alta");
    expect(audioLevelLabel("medium")).toBe("média");
    expect(audioLevelLabel("alta")).toBe("alta");
    expect(audioLevelLabel("low")).toBe("baixa");
    expect(audioLevelLabel("baixa")).toBe("baixa");
    expect(audioLevelLabel("baixa/media")).toBe("baixa");
    expect(normalizeAudioLevel("low")).toBe("low");
    expect(audioLevelLabel("pending")).toBe("pending");
    expect(audioLevelLabel(undefined)).toBeUndefined();
  });
});

describe("mergeAudioLyricsInsights energy handling", () => {
  const lyrics = analyzeLyricsDraft("Linha curta de letra aqui");
  const base: TrackAudioAnalysis = { status: "completed", provider: "test", missingData: [] };

  it("treats canonical and legacy high energy the same", () => {
    for (const energy of ["high", "alta"]) {
      const diagnosis = mergeAudioLyricsInsights({ ...base, energy }, lyrics);
      expect(diagnosis.commercialPotential).toContain("alto");
      expect(diagnosis.platformPriority[0]).toBe("TikTok");
      expect(diagnosis.energy).toBe("alta");
    }
  });

  it("shows PT-BR copy for non-high energy", () => {
    const diagnosis = mergeAudioLyricsInsights({ ...base, energy: "medium" }, lyrics);
    expect(diagnosis.energy).toBe("média");
    expect(diagnosis.commercialPotential).toContain("médio");
  });
});
