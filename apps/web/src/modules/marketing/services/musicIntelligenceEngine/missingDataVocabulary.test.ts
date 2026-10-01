import { describe, expect, it } from "vitest";
import { analyzeAudioDraft } from "./analyzeAudio";
import { analyzeLyricsDraft } from "./analyzeLyrics";
import { missingDataLabel } from "./missingDataVocabulary";

describe("missing-data vocabulary", () => {
  it("emits English machine tokens", () => {
    const audio = analyzeAudioDraft({ audioUrl: "", genre: "", subgenre: "", mood: "", bpm: "" } as never);
    expect(audio.missingData).toEqual(["audio", "bpm", "mood", "genre", "subgenre"]);
    expect(audio.structure).toEqual([]);
    const filled = analyzeAudioDraft({ audioUrl: "https://x/a.mp3", genre: "pop", subgenre: "x", mood: "m", bpm: "100" } as never);
    expect(filled.structure).toEqual(["intro", "verse", "chorus", "bridge"]);
    expect(analyzeLyricsDraft("").missingData).toEqual(["lyrics"]);
  });

  it("renders PT-BR labels and keeps unknown markers", () => {
    expect(missingDataLabel("genre")).toBe(missingDataLabel("genre"));
    expect(missingDataLabel("lyrics")).not.toBe("lyrics");
    expect(missingDataLabel("custom")).toBe("custom");
  });
});
