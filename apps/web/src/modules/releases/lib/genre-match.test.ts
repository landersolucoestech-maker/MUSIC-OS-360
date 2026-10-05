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

describe("matchGenre electronic aliases (each alias key resolved separately)", () => {
  it.each(["Electrónico", "eletrónico", "electronico", "eletronico", "electronica", "Electronica", "  ELETRONICO "])(
    "%j resolves to eletronica",
    (raw) => {
      expect(matchGenre(raw)).toBe("eletronica");
    },
  );
  it("the canonical value maps to itself", () => {
    expect(matchGenre("eletronica")).toBe("eletronica");
  });
  it.each(["eletronicoo", "electronic", "electroni"])("near-miss %j does not map to eletronica", (raw) => {
    expect(matchGenre(raw)).not.toBe("eletronica");
  });
});
