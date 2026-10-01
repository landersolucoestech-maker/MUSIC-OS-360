import { describe, expect, it } from "vitest";
import { analyzeLyricsDraft } from "./analyzeLyrics";
import {
  lyricsSentimentLabel,
  lyricsToneLabel,
  normalizeLyricsSentiment,
  normalizeLyricsTone,
} from "./lyricsVocabulary";
import { mergeAudioLyricsInsights } from "./mergeAudioLyricsInsights";
import type { TrackAudioAnalysis, TrackLyricsAnalysis } from "./types";

const audio: TrackAudioAnalysis = { status: "pending", provider: "test", missingData: [] };

describe("analyzeLyricsDraft machine vocabulary", () => {
  it("emits English ids; Portuguese probes still detect Portuguese lyrics", () => {
    expect(analyzeLyricsDraft("Chorei de saudade na estrada").sentiment).toBe("melancholic");
    expect(analyzeLyricsDraft("Vamos fazer festa e brilhar").sentiment).toBe("positive");
    expect(analyzeLyricsDraft("Caminhando pela rua devagar").sentiment).toBe("mixed");
    expect(analyzeLyricsDraft("Linha curta de letra aqui").tone).toBe("direct");
    expect(analyzeLyricsDraft("palavra ".repeat(200)).tone).toBe("narrative");
  });
});

describe("lyrics vocabulary compat mapper", () => {
  it("reads canonical and legacy Portuguese stored tokens", () => {
    expect(normalizeLyricsSentiment("melancholic")).toBe("melancholic");
    expect(normalizeLyricsSentiment("melancolico")).toBe("melancholic");
    expect(normalizeLyricsSentiment("Melancólico")).toBe("melancholic");
    expect(normalizeLyricsSentiment("positivo")).toBe("positive");
    expect(normalizeLyricsSentiment("misto")).toBe("mixed");
    expect(normalizeLyricsSentiment("unknown-value")).toBeUndefined();
    expect(normalizeLyricsTone("narrativo")).toBe("narrative");
    expect(normalizeLyricsTone("direct")).toBe("direct");
  });

  it("maps ids to PT-BR display copy and passes free text through", () => {
    expect(lyricsSentimentLabel("melancholic")).toBe("melancólico");
    expect(lyricsSentimentLabel("melancolico")).toBe("melancólico");
    expect(lyricsSentimentLabel("free text")).toBe("free text");
    expect(lyricsToneLabel("narrative")).toBe("narrativo");
    expect(lyricsSentimentLabel(undefined)).toBeUndefined();
  });
});

describe("mergeAudioLyricsInsights with lyrics sentiment", () => {
  const lyrics = (sentiment: string): TrackLyricsAnalysis =>
    ({ status: "completed", provider: "t", secondaryThemes: [], hooks: [], viralPhrases: [], keywords: [], editorialTags: [], missingData: [], sentiment }) as unknown as TrackLyricsAnalysis;

  it.each(["melancholic", "melancolico"])("treats %s as melancholic for sync potential and shows PT-BR copy", (value) => {
    const diagnosis = mergeAudioLyricsInsights(audio, lyrics(value));
    expect(diagnosis.syncPotential).toContain("emocionais");
    expect(diagnosis.sentiment).toBe("melancólico");
  });

  it("falls back to the sentiment copy as mood when audio mood is pending", () => {
    expect(mergeAudioLyricsInsights(audio, lyrics("positive")).mood).toBe("positivo");
  });
});
