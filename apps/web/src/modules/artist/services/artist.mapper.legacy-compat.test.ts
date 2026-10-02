import { describe, expect, it } from "vitest";
import { normalizeSpecialty } from "./artist.mapper";

describe("pre-CZ-042 spreadsheet specialty values (import compatibility)", () => {
  it.each([
    ["dj_produtor", "dj_producer"],
    ["compositor_autor", "songwriter"],
    ["interprete", "performer"],
    ["produtor", "producer"],
  ])("normalizes %j to %s", (legacy, canonical) => {
    expect(normalizeSpecialty(legacy)).toBe(canonical);
  });
});
