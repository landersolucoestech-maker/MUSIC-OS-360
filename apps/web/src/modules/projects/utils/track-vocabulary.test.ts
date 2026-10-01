import { describe, expect, it } from "vitest";
import {
  TRACK_INSTRUMENTAL_OPTIONS,
  TRACK_LANGUAGE_OPTIONS,
  canonicalTrackInstrumental,
  canonicalTrackLanguage,
  trackLanguageLabel,
} from "./track-vocabulary";
import { getTrackInfo, getFirstTrackInfo } from "./track-helpers";
import { projectToWorkSeed } from "@/modules/catalog/services/music-registration.mapper";
import { LANGUAGES } from "@/constants/languages";

describe("project track vocabulary (AP3 R3-06)", () => {
  it("instrumental is yes/no; the legacy sim/nao is read, never written", () => {
    expect(canonicalTrackInstrumental("sim")).toBe("yes");
    expect(canonicalTrackInstrumental("nao")).toBe("no");
    expect(canonicalTrackInstrumental("não")).toBe("no");
    expect(canonicalTrackInstrumental("yes")).toBe("yes");
    expect(canonicalTrackInstrumental(undefined)).toBe("");
    expect(TRACK_INSTRUMENTAL_OPTIONS.map((o) => o.value)).toEqual(["no", "yes"]);
    expect(getTrackInfo({ instrumental: "sim" }).instrumental).toBe("yes");
    expect(getTrackInfo({}).instrumental).toBe("no");
    expect(getFirstTrackInfo(null).instrumental).toBe("no");
  });

  it("language options carry ISO 639 codes with PT-BR labels; a legacy slug reads as its code, free text stays", () => {
    expect(TRACK_LANGUAGE_OPTIONS).toHaveLength(LANGUAGES.length);
    expect(TRACK_LANGUAGE_OPTIONS.find((o) => o.label === "Português")?.value).toBe("pt");
    expect(TRACK_LANGUAGE_OPTIONS.find((o) => o.label === "Inglês")?.value).toBe("en");
    for (const o of TRACK_LANGUAGE_OPTIONS) expect(o.value).toMatch(/^[a-z]{2,3}$/);
    expect(canonicalTrackLanguage("portugues")).toBe("pt");
    expect(canonicalTrackLanguage("pt")).toBe("pt");
    expect(canonicalTrackLanguage("Dialeto local")).toBe("Dialeto local");
    expect(trackLanguageLabel("ingles")).toBe("Inglês");
    expect(trackLanguageLabel("en")).toBe("Inglês");
    expect(trackLanguageLabel("Dialeto local")).toBe("Dialeto local");
    expect(getTrackInfo({ language: "portugues" }).language).toBe("pt");
  });

  it("the work seed reads both vocabularies", () => {
    for (const track of [{ instrumental: "yes", language: "pt" }, { instrumental: "sim", language: "portugues" }]) {
      expect(projectToWorkSeed({ id: "p" }, track)).toMatchObject({ is_instrumental: true, language: "pt" });
    }
    expect(projectToWorkSeed({ id: "p" }, { instrumental: "no" }).is_instrumental).toBe(false);
  });
});
