/**
 * The phonograms list cells read the structured `participation` jsonb
 * (columns compositores/interpretes/produtores were dropped by migration
 * 20260923000002). Composers are not a phonogram field: they live on the
 * linked work.
 */
import { describe, it, expect } from "vitest";
import {
  PHONOGRAM_LIST_PARTICIPANT_COLUMNS,
  participantNames,
  phonogramListSortValue,
} from "@/modules/catalog/lib/phonogram-participants";
import type { Phonogram } from "@/modules/catalog/types/catalog.types";

const phonogram = (participation: Phonogram["participation"]): Phonogram => ({ id: "p1", title: "T", participation });

describe("participantNames", () => {
  it("joins the participant names of the category", () => {
    const p = phonogram({
      performers: [
        { id: "1", name: "Alice", percentage: "50" },
        { id: "2", name: " Bob ", percentage: "50" },
      ],
    });
    expect(participantNames(p, "performers")).toBe("Alice, Bob");
  });

  it("reads the phonographic producers category", () => {
    const p = phonogram({ phonographic_producers: [{ id: "1", name: "Label X", percentage: "100" }] });
    expect(participantNames(p, "phonographic_producers")).toBe("Label X");
  });

  it("is empty for missing participation, empty categories and blank names", () => {
    expect(participantNames(phonogram(null), "performers")).toBe("");
    expect(participantNames(phonogram({ performers: [] }), "performers")).toBe("");
    expect(participantNames(phonogram({ performers: [{ id: "1", name: "  ", percentage: "" }] }), "performers")).toBe("");
    expect(participantNames({ id: "p" } as Phonogram, "performers")).toBe("");
  });

  it("never reads the dropped Portuguese columns", () => {
    const legacy = { id: "p", interpretes: "Old", produtores: "Old", compositores: "Old" } as Phonogram;
    expect(participantNames(legacy, "performers")).toBe("");
    expect(participantNames(legacy, "phonographic_producers")).toBe("");
  });
});

describe("list columns and sort", () => {
  it("uses English sort keys with PT-BR labels", () => {
    expect(PHONOGRAM_LIST_PARTICIPANT_COLUMNS).toEqual([
      { key: "performers", label: "Intérpretes" },
      { key: "phonographic_producers", label: "Produtor" },
    ]);
  });

  it("sorts by the participant names", () => {
    const p = phonogram({ performers: [{ id: "1", name: "Zed", percentage: "" }] });
    expect(phonogramListSortValue(p, "performers")).toBe("Zed");
    expect(phonogramListSortValue(p, "phonographic_producers")).toBe("");
    expect(phonogramListSortValue(p, "title")).toBe("T");
  });
});
