import { describe, expect, it } from "vitest";
import {
  canonicalContractCategorySlug,
  findServiceTypeByCategory,
  isSemanticContractCategory,
  sameContractCategory,
} from "./contract-category-slugs";

// Static list on purpose (not derived from the reader): dropping or renaming any legacy entry fails its row.
const LEGACY_TO_CANONICAL: Array<[string, string]> = [
  ["gravacao", "recording"],
  ["cessao_direitos", "rights_assignment"],
  ["producao", "production"],
  ["exclusividade", "exclusivity"],
  ["publicitario", "advertising"],
  ["semantico", "semantic"],
  ["distribuicao", "distribution"],
  ["licenciamento", "licensing"],
  ["gestao", "management"],
  ["outros", "other"],
  ["outro", "other"],
];

describe("contract category slugs: the web reads the legacy spelling and the canonical one as one category", () => {
  it.each(LEGACY_TO_CANONICAL)("canonicalContractCategorySlug(%s) -> %s", (legacy, canonical) => {
    expect(canonicalContractCategorySlug(legacy)).toBe(canonical);
    expect(canonicalContractCategorySlug(canonical)).toBe(canonical);
  });

  it.each(LEGACY_TO_CANONICAL)("sameContractCategory(%s, %s) is true in both directions", (legacy, canonical) => {
    expect(sameContractCategory(legacy, canonical)).toBe(true);
    expect(sameContractCategory(canonical, legacy)).toBe(true);
  });

  it("tenant-created slugs are never rewritten and inherited object keys are not legacy slugs", () => {
    expect(canonicalContractCategorySlug("parceria")).toBe("parceria");
    expect(canonicalContractCategorySlug("constructor")).toBe("constructor");
    expect(canonicalContractCategorySlug("toString")).toBe("toString");
  });

  it("different categories and empty values are not the same category", () => {
    expect(sameContractCategory("cessao_direitos", "advertising")).toBe(false);
    expect(sameContractCategory("publicitario", "rights_assignment")).toBe(false);
    expect(sameContractCategory("gestao", "distribution")).toBe(false);
    expect(sameContractCategory("outro", "outros")).toBe(true);
    expect(sameContractCategory(null, "other")).toBe(false);
    expect(sameContractCategory("other", undefined)).toBe(false);
    expect(sameContractCategory("", "")).toBe(false);
  });

  it("the semantic category is recognised in either spelling and nothing else is", () => {
    expect(isSemanticContractCategory("semantic")).toBe(true);
    expect(isSemanticContractCategory("semantico")).toBe(true);
    expect(isSemanticContractCategory("publicitario")).toBe(false);
    expect(isSemanticContractCategory(null)).toBe(false);
  });

  it("findServiceTypeByCategory finds a tenant row stored in the legacy spelling from a canonical contract category and vice versa", () => {
    const types = [{ slug: "cessao_direitos", id: 1 }, { slug: "publicitario", id: 2 }, { slug: "custom", id: 3 }];
    expect(findServiceTypeByCategory(types, "rights_assignment")?.id).toBe(1);
    expect(findServiceTypeByCategory(types, "advertising")?.id).toBe(2);
    expect(findServiceTypeByCategory([{ slug: "advertising", id: 9 }], "publicitario")?.id).toBe(9);
    expect(findServiceTypeByCategory(types, "custom")?.id).toBe(3);
    expect(findServiceTypeByCategory(types, "recording")).toBeUndefined();
    expect(findServiceTypeByCategory(types, null)).toBeUndefined();
  });

  it("an exact slug match wins over a legacy/canonical equivalent that comes first", () => {
    const types = [{ slug: "cessao_direitos", id: 1 }, { slug: "rights_assignment", id: 2 }];
    expect(findServiceTypeByCategory(types, "rights_assignment")?.id).toBe(2);
    expect(findServiceTypeByCategory(types, "cessao_direitos")?.id).toBe(1);
  });
});
