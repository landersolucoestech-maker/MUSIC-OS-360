import { describe, expect, it } from "vitest";
import {
  getCounterpartiesByType,
  getLinkOptions,
  getTransactionTypes,
  toFormCounterpartyType,
  toFormLink,
  toFormTransactionType,
  toRuleCounterpartyType,
  toRuleLink,
  toRuleTransactionType,
} from "./financialRules.utils";
import type { FinancialCategoryRuleEntity } from "@/modules/accounting/types/financial-category-rules.types";

describe("financialRules.utils PT-BR rule labels <-> canonical English form values", () => {
  it.each([
    ["Receita", "revenue"],
    ["Despesa", "expense"],
    ["Investimento", "investment"],
    ["Imposto", "tax"],
  ] as const)("transaction type label %s <-> %s", (label, value) => {
    expect(toFormTransactionType(label)).toBe(value);
    expect(toRuleTransactionType(value)).toBe(label);
  });

  it.each([
    ["Empresa", "company"],
    ["Pessoa", "individual"],
    ["Artista", "artist"],
    ["Governo", "government"],
  ] as const)("counterparty label %s <-> %s", (label, value) => {
    expect(toFormCounterpartyType(label)).toBe(value);
    expect(toRuleCounterpartyType(value)).toBe(label);
  });

  it.each([
    ["Artista", "artist"],
    ["Projeto", "project"],
    ["Contrato", "contract"],
    ["Evento", "event"],
  ] as const)("link label %s <-> %s", (label, value) => {
    expect(toFormLink(label)).toBe(value);
    expect(toRuleLink(value)).toBe(label);
  });

  it("the Portuguese label is not itself a form value", () => {
    expect(toRuleTransactionType("Receita")).toBeNull();
    expect(toRuleCounterpartyType("Empresa")).toBeNull();
    expect(toRuleLink("Projeto")).toBeNull();
  });

  it("option builders emit the canonical value with the PT-BR label", () => {
    const rule = {
      id: "r", transaction_type: "Receita", counterparty_type: "Empresa", category: "c", subcategory: null,
      links: ["Contrato", "Evento"], active: true, sort_order: 1, created_at: "", updated_at: "",
    } as FinancialCategoryRuleEntity;
    expect(getTransactionTypes([rule])).toEqual([{ value: "revenue", label: "Receita" }]);
    expect(getCounterpartiesByType([rule], "revenue")).toEqual([{ value: "company", label: "Empresa" }]);
    expect(getLinkOptions(rule)).toEqual([
      { value: "contract", label: "Contrato" },
      { value: "event", label: "Evento" },
    ]);
  });
});
