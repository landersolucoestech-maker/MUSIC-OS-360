import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useFinancialRules } from "./useFinancialRules";
import { initialFormData, type TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

function rulesFor(overrides: Partial<TransactionFormData>) {
  const formData = { ...initialFormData, ...overrides };
  return renderHook(() => useFinancialRules({ formData, events: [] })).result.current;
}

const values = (options: { value: string }[]) => options.map((o) => o.value);

beforeEach(() => localStorage.clear());

describe("useFinancialRules: catalog lookups feed the selects", () => {
  it("categories: the option list of the type/counterparty pair (not the type string)", () => {
    const { categories } = rulesFor({ transactionType: "expense", counterpartyType: "company" });
    expect(Array.isArray(categories)).toBe(true);
    expect(values(categories)).toContain("services");
    expect(categories.every((o) => typeof o.label === "string" && o.label.length > 1)).toBe(true);
    expect(categories.find((o) => o.value === "services")?.label).toBe("Serviços");
  });

  it("categories: artist revenue differs from company revenue", () => {
    expect(values(rulesFor({ transactionType: "revenue", counterpartyType: "artist" }).categories)).toContain("show_fee");
    expect(values(rulesFor({ transactionType: "revenue", counterpartyType: "company" }).categories)).not.toContain("show_fee");
  });

  it("categories: negative, an unknown pair has no options", () => {
    expect(rulesFor({ transactionType: "expense", counterpartyType: "unknown_party" }).categories).toEqual([]);
    expect(rulesFor({ transactionType: "unknown_type", counterpartyType: "company" }).categories).toEqual([]);
    expect(rulesFor({}).categories).toEqual([]);
  });

  it("subcategories: a legacy category slug lists the subcategories of its canonical twin", () => {
    const legacy = rulesFor({ transactionType: "revenue", counterpartyType: "company", category: "servicos" });
    const canonical = rulesFor({ transactionType: "revenue", counterpartyType: "company", category: "services" });
    expect(Array.isArray(legacy.subcategories)).toBe(true);
    expect(values(legacy.subcategories)).toContain("studio_recording");
    expect(legacy.subcategories).toEqual(canonical.subcategories);
    const musicLegacy = rulesFor({ transactionType: "revenue", counterpartyType: "company", category: "receitas-musicais" });
    expect(values(musicLegacy.subcategories)).toContain("neighboring_rights");
  });

  it("subcategories: negative, an unknown category or pair has none", () => {
    expect(rulesFor({ transactionType: "revenue", counterpartyType: "company", category: "unknown_category" }).subcategories).toEqual([]);
    expect(rulesFor({ transactionType: "revenue", counterpartyType: "company", category: "outros" }).subcategories).toEqual([]);
    expect(rulesFor({ transactionType: "expense", counterpartyType: "unknown_party", category: "servicos" }).subcategories).toEqual([]);
  });

  it("investmentItems: a legacy category slug lists the items of its canonical twin", () => {
    const legacy = rulesFor({ transactionType: "investment", category: "tecnologia" });
    const canonical = rulesFor({ transactionType: "investment", category: "technology" });
    expect(Array.isArray(legacy.investmentItems)).toBe(true);
    expect(legacy.investmentItems.length).toBeGreaterThan(1);
    expect(legacy.investmentItems).toEqual(canonical.investmentItems);
    expect(values(legacy.investmentItems)).toContain("daw_software");
    expect(values(rulesFor({ transactionType: "investment", category: "equipamentos" }).investmentItems)).toContain("microphone");
  });

  it("investmentItems: negative, an unknown or empty category has none", () => {
    expect(rulesFor({ transactionType: "investment", category: "unknown_category" }).investmentItems).toEqual([]);
    expect(rulesFor({ transactionType: "investment", category: "servicos" }).investmentItems).toEqual([]);
    expect(rulesFor({ transactionType: "investment", category: "" }).investmentItems).toEqual([]);
  });
});
