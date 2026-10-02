import { describe, it, expect } from "vitest";
import { normalizeLyricsTone, lyricsToneLabel } from "./lyricsVocabulary";

describe("lyrics tone legacy alias", () => {
  it.each([
    ["direto", "direct"],
    ["  Direto ", "direct"],
    ["direct", "direct"],
    ["narrativo", "narrative"],
  ])("normalizes %j to %s", (input, canonical) => {
    expect(normalizeLyricsTone(input)).toBe(canonical);
  });

  it("labels the legacy token with the canonical display copy and leaves unknown text alone", () => {
    expect(lyricsToneLabel("direto")).toBe(lyricsToneLabel("direct"));
    expect(normalizeLyricsTone("sarcastic")).toBeUndefined();
    expect(lyricsToneLabel("sarcastic")).toBe("sarcastic");
  });
});

describe("lyrics tone display copy", () => {
  it("renders the canonical tone with its fixed PT-BR label", () => {
    expect(lyricsToneLabel("direct")).toBe("direto");
    expect(lyricsToneLabel("narrative")).toBe("narrativo");
    expect(lyricsToneLabel("direto")).toBe("direto");
  });
});
