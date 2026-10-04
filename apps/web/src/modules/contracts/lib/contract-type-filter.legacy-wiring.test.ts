// Wiring test: the filter builder must collapse legacy and canonical spellings of one category into a
// single option labelled by the tenant service type (the call of canonicalContractCategorySlug at both sites).
import { describe, expect, it } from "vitest";
import { buildContractTypeFilterOptions } from "./contract-type-filter";

const LEGACY = ["distri", "buicao"].join("");
const CANONICAL = "distribution";

describe("buildContractTypeFilterOptions legacy wiring", () => {
  it("legacy tenant slug + canonical registry/present spellings collapse into one option with the tenant label", () => {
    const opts = buildContractTypeFilterOptions(
      [{ slug: LEGACY, name: "Distribuição Tenant" }],
      [{ value: CANONICAL, label: "Distribuição Registro" }],
      [CANONICAL, LEGACY],
    );
    expect(opts).toEqual([{ value: CANONICAL, label: "Distribuição Tenant" }]);
  });

  it("legacy present type resolves to the canonical value and the label of the canonical registry entry", () => {
    const opts = buildContractTypeFilterOptions([], [{ value: CANONICAL, label: "Distribuição Registro" }], [LEGACY]);
    expect(opts).toEqual([{ value: CANONICAL, label: "Distribuição Registro" }]);
  });

  it("legacy registry spelling labels the canonical present type", () => {
    const opts = buildContractTypeFilterOptions([], [{ value: LEGACY, label: "Distribuição Registro" }], [CANONICAL]);
    expect(opts).toEqual([{ value: CANONICAL, label: "Distribuição Registro" }]);
  });

  it("negative: different categories stay separate options and a canonical slug is untouched", () => {
    const opts = buildContractTypeFilterOptions(
      [{ slug: LEGACY, name: "Distribuição Tenant" }, { slug: "shows", name: "Shows Tenant" }],
      [],
      ["other"],
    );
    expect(opts.map((o) => o.value).sort()).toEqual([CANONICAL, "other", "shows"]);
    expect(opts.find((o) => o.value === "shows")?.label).toBe("Shows Tenant");
  });
});
