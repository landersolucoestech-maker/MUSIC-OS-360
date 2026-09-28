import { describe, it, expect } from "vitest";
import {
  parseDurationText,
  formatDurationText,
  parseIsrc,
  joinIsrc,
  workToParticipants,
  participantsToComposerAndTranslatorNames,
  workTitle,
  workToFormFields,
  phonogramToParticipation,
} from "@/modules/catalog/mappers";

describe("parseDurationText", () => {
  it("parses MM:SS", () => {
    expect(parseDurationText("03:45")).toEqual({ minutes: "3", seconds: "45" });
  });
  it("parses HH:MM:SS by collapsing hours into minutes", () => {
    expect(parseDurationText("01:02:30")).toEqual({ minutes: "62", seconds: "30" });
  });
  it("returns empty parts for missing duration", () => {
    expect(parseDurationText(null)).toEqual({ minutes: "", seconds: "" });
    expect(parseDurationText("")).toEqual({ minutes: "", seconds: "" });
  });
});

describe("formatDurationText", () => {
  it("formats min/seg into MM:SS", () => {
    expect(formatDurationText("3", "45")).toBe("03:45");
    expect(formatDurationText(0, 5)).toBe("00:05");
  });
  it("returns null when both empty", () => {
    expect(formatDurationText("", "")).toBeNull();
  });
});

describe("parseIsrc", () => {
  it("parses BR-XXX-YY-NNNNN", () => {
    expect(parseIsrc("BR-ABC-25-12345")).toEqual({
      countryCode: "BR",
      registrantCode: "ABC",
      year: "25",
      designationCode: "12345",
    });
  });
  it("parses compact format BRXXXYYNNNNN", () => {
    expect(parseIsrc("BRABC2512345")).toEqual({
      countryCode: "BR",
      registrantCode: "ABC",
      year: "25",
      designationCode: "12345",
    });
  });
  it("defaults to BR for empty input", () => {
    expect(parseIsrc(null)).toEqual({
      countryCode: "BR",
      registrantCode: "",
      year: "",
      designationCode: "",
    });
  });
});

describe("joinIsrc", () => {
  it("joins all four parts", () => {
    expect(
      joinIsrc({ countryCode: "BR", registrantCode: "ABC", year: "25", designationCode: "12345" }),
    ).toBe("BR-ABC-25-12345");
  });
  it("returns null when any part missing", () => {
    expect(
      joinIsrc({ countryCode: "BR", registrantCode: "", year: "25", designationCode: "12345" }),
    ).toBeNull();
  });
});

describe("workTitle", () => {
  it("prefers DB title, falls back to legacy titulo", () => {
    expect(workTitle({ title: "DB Title", titulo: "Legacy" })).toBe("DB Title");
    expect(workTitle({ titulo: "Legacy" })).toBe("Legacy");
    expect(workTitle(null)).toBe("");
  });
});

describe("workToParticipants", () => {
  it("expands composer_names and translator_names into participants with canonical roles", () => {
    const result = workToParticipants({
      composer_names: ["Alice", "Bob"],
      translator_names: ["Carol"],
    });
    expect(result).toHaveLength(3);
    expect(result.filter((p) => p.role === "composer_author")).toHaveLength(2);
    expect(result.filter((p) => p.role === "translator")).toHaveLength(1);
    expect(result.find((p) => p.role === "translator")?.name).toBe("Carol");
  });
  it("reads the canonical participants array (role/percentage; null link/percentage become empty inputs)", () => {
    const result = workToParticipants({
      participants: [
        { id: "1", name: "Dan", role: "publisher", link: null, percentage: "25.000" },
        { id: "2", name: "Eve", role: "unspecified", link: "https://e.test", percentage: null },
      ],
      composer_names: ["Ignored When Participants Exist"],
    });
    expect(result).toEqual([
      { id: "1", name: "Dan", role: "publisher", link: "", percentage: "25.000" },
      { id: "2", name: "Eve", role: "unspecified", link: "https://e.test", percentage: "" },
    ]);
  });
  it("returns [] when no fields are present", () => {
    expect(workToParticipants({})).toEqual([]);
    expect(workToParticipants(null)).toEqual([]);
  });
});

describe("participantsToComposerAndTranslatorNames", () => {
  it("splits the participants back into composer/translator name lists", () => {
    const result = participantsToComposerAndTranslatorNames([
      { id: "1", name: "Alice", role: "composer_author", link: "", percentage: "" },
      { id: "2", name: "Carol", role: "translator", link: "", percentage: "" },
      { id: "3", name: "  ", role: "composer_author", link: "", percentage: "" },
      { id: "4", name: "Dan", role: "publisher", link: "", percentage: "" },
    ]);
    expect(result.composerNames).toEqual(["Alice"]);
    expect(result.translatorNames).toEqual(["Carol"]);
  });
  it("returns nulls when no entries match", () => {
    expect(participantsToComposerAndTranslatorNames([])).toEqual({
      composerNames: null,
      translatorNames: null,
    });
  });
});

describe("workToFormFields (canonical work record → form state)", () => {
  it("reads only the canonical CZ-039 fields", () => {
    const fields = workToFormFields({
      title: "Canção",
      status: "registered",
      music_genre: "Pop",
      language: "pt",
      duration_text: "03:45",
      is_instrumental: true,
      ecad_code: "E-1",
      society_code: "S-1",
      iswc: "T-1",
      ai_used: true,
      ai_usage_level: "full",
      ai_harmony: { tool: "Suno", prompt: "p" },
      ai_melody: null,
      ai_lyrics: { tool: "", prompt: "rhyme" },
      alternative_titles: ["Alt"],
      related_references: ["Ref"],
      lyrics: "Letra",
      artist_id: "art-1",
    });
    expect(fields).toMatchObject({
      title: "Canção",
      status: "registered",
      musicGenre: "pop",
      language: "pt",
      durationMinutes: "3",
      durationSeconds: "45",
      isInstrumental: true,
      ecadCode: "E-1",
      societyCode: "S-1",
      iswc: "T-1",
      aiUsed: true,
      aiUsageLevel: "full",
      aiHarmony: { tool: "Suno", prompt: "p" },
      aiMelody: { tool: "", prompt: "" },
      aiLyrics: { tool: "", prompt: "rhyme" },
      alternativeTitles: ["Alt"],
      relatedReferences: ["Ref"],
      lyrics: "Letra",
      artistId: "art-1",
    });
  });
  it("yields empty/false defaults for a blank record (booleans, never 'sim'/'nao')", () => {
    const fields = workToFormFields(null);
    expect(fields.isInstrumental).toBe(false);
    expect(fields.aiUsed).toBe(false);
    expect(fields.aiUsageLevel).toBe("");
    expect(fields.language).toBe("");
    expect(fields.status).toBe("");
    expect(fields.participants).toEqual([]);
  });
  it("ignores a value outside the ai_usage_level contract", () => {
    expect(workToFormFields({ ai_usage_level: "unknown_level" as never }).aiUsageLevel).toBe("");
  });
});

describe("phonogramToParticipation (canonical CZ-040 participation)", () => {
  it("reads the canonical categories and item keys", () => {
    const result = phonogramToParticipation({
      participation: {
        phonographic_producers: [{ id: "1", name: "X", percentage: "10", artist_id: "art-1" }],
        performers: [{ id: "2", name: "Y", percentage: "41.7" }],
        session_musicians: [],
      },
    });
    expect(result).toEqual({
      phonographic_producers: [{ id: "1", name: "X", percentage: "10", artist_id: "art-1" }],
      performers: [{ id: "2", name: "Y", percentage: "41.7" }],
      session_musicians: [],
    });
  });
  it("ignores the pre-CZ-040 participacao object, its category keys and `percentual`", () => {
    const legacy = {
      participacao: { produtorFonografico: [{ id: "1", name: "X", percentual: "10" }] },
      produtores: ["P1"],
      participation: { interprete: [{ id: "9", name: "Z" }], performers: [{ id: "2", name: "Y", percentual: "5" }] },
    };
    expect(phonogramToParticipation(legacy as never)).toEqual({
      phonographic_producers: [],
      performers: [{ id: "2", name: "Y", percentage: "" }],
      session_musicians: [],
    });
  });
  it("returns empty categories when the phonogram is null", () => {
    expect(phonogramToParticipation(null)).toEqual({
      phonographic_producers: [],
      performers: [],
      session_musicians: [],
    });
  });
});

describe("duration_text round-trip", () => {
  it("DB string → parts → DB string", () => {
    const cases = ["00:05", "03:45", "10:00", "59:59"];
    for (const dur of cases) {
      const { minutes, seconds } = parseDurationText(dur);
      expect(formatDurationText(minutes, seconds)).toBe(dur);
    }
  });
});

describe("ISRC round-trip", () => {
  it("DB string → parts → DB string", () => {
    const v = "BR-ABC-25-12345";
    expect(joinIsrc(parseIsrc(v))).toBe(v);
  });
});
