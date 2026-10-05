import { describe, expect, it } from "vitest";
import { genreLabel, matchGenre } from "./genre-match";

const PROTOTYPE_KEYS = ["constructor", "__proto__", "toString", "hasOwnProperty"];

describe("genre-match own-property lookups", () => {
  it.each(PROTOTYPE_KEYS)("matchGenre(%s) returns the typed text, never an inherited member", (key) => {
    expect(matchGenre(key)).toBe(key.toLowerCase());
  });
  it.each(PROTOTYPE_KEYS)("genreLabel(%s) returns the text itself", (key) => {
    expect(genreLabel(key)).toBe(key);
  });
  it("keeps known aliases and labels", () => {
    expect(matchGenre("Eletrônico")).toBe("eletronica");
    expect(genreLabel("eletronica")).toBe("Eletrônica");
  });
});
