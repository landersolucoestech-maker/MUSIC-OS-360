import { describe, expect, it } from "vitest";
import { buildContractTypeFilterOptions } from "./contract-type-filter";
import { canonicalContractCategorySlug, isSemanticContractCategory, sameContractCategory } from "./contract-category-slugs";
import { contractCategoryLabel } from "../hooks/useCategoryRegistry";

describe("contract category slugs", () => {
  it("treats legacy and canonical spellings of platform-owned slugs as the same category", () => {
    expect(canonicalContractCategorySlug("gravacao")).toBe("recording");
    expect(canonicalContractCategorySlug("recording")).toBe("recording");
    expect(canonicalContractCategorySlug("empresariamento_360")).toBe("empresariamento_360");
    expect(canonicalContractCategorySlug("toString")).toBe("toString");
    expect(sameContractCategory("gravacao", "recording")).toBe(true);
    expect(sameContractCategory("shows", "gravacao")).toBe(false);
    expect(isSemanticContractCategory("semantico")).toBe(true);
    expect(isSemanticContractCategory("semantic")).toBe(true);
    expect(isSemanticContractCategory("outros")).toBe(false);
  });

  it("label lookup accepts either spelling", () => {
    const registry = [{ value: "gravacao", label: "Gravação" }];
    expect(contractCategoryLabel(registry, "recording")).toBe("Gravação");
    expect(contractCategoryLabel([{ value: "recording", label: "Gravação" }], "gravacao")).toBe("Gravação");
  });
});

describe("buildContractTypeFilterOptions", () => {
  it("is data-driven: service types + registry + types present in contracts", () => {
    const opts = buildContractTypeFilterOptions(
      [{ slug: "agenciamento", name: "Agenciamento" }],
      [{ value: "shows", label: "Shows e Eventos" }],
      ["agenciamento", "shows", "custom_slug"],
    );
    expect(opts.map((o) => o.value).sort()).toEqual(["agenciamento", "custom_slug", "shows"]);
    expect(opts.find((o) => o.value === "shows")?.label).toBe("Shows e Eventos");
  });

  it("a type present only in data is still filterable and never shows a raw underscore slug", () => {
    const opts = buildContractTypeFilterOptions([], [], ["empresariamento_360"]);
    expect(opts).toHaveLength(1);
    expect(opts[0].value).toBe("empresariamento_360");
    expect(opts[0].label).not.toContain("_");
  });

  it("collapses legacy and canonical spellings into one option with the canonical value", () => {
    const opts = buildContractTypeFilterOptions([], [{ value: "gravacao", label: "Gravação" }], ["gravacao", "recording"]);
    expect(opts).toEqual([{ value: "recording", label: "Gravação" }]);
  });

  it("ignores the null-group bucket", () => {
    expect(buildContractTypeFilterOptions([], [], ["—"])).toEqual([]);
  });
});
