import { describe, it, expect } from "vitest";
import { ARTIST_TEAM_CONTACT_CATEGORIES, ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR } from "@music-os-360/types";
import { teamContactCategoryLabel } from "./team-contact-category";

describe("teamContactCategoryLabel", () => {
  it.each(ARTIST_TEAM_CONTACT_CATEGORIES)("canonical %s -> its PT-BR label", (c) => {
    expect(teamContactCategoryLabel(c)).toBe(ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR[c]);
    expect(teamContactCategoryLabel(c)).not.toBe("Outro");
  });
  it.each([
    ["assessoria", "press_office"], ["juridico", "legal"], ["financeiro", "finance"], ["contador", "accountant"],
    ["empresario", "agent"], ["gestor", "agent"], ["editora_musical", "publisher"], ["editora", "publisher"], ["gravadora", "record_label"],
  ] as const)("legacy %s -> label of %s", (legacy, canonical) => {
    expect(teamContactCategoryLabel(legacy)).toBe(ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR[canonical]);
  });
  it("is case/space tolerant and unknown/empty/prototype keys fall back to Outro", () => {
    expect(teamContactCategoryLabel(" Legal ")).toBe("Jurídico");
    for (const v of ["x_unknown", "", null, undefined, "constructor", "__proto__"]) expect(teamContactCategoryLabel(v)).toBe("Outro");
  });
});
