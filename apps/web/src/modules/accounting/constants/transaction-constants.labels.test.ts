import { describe, expect, it } from "vitest";
import {
  LEGACY_CATEGORY_SUFFIX,
  TRANSACTION_CATEGORY_OPTION_LISTS,
  buildTransactionCategoryFilterOptions,
  transactionCategoryLabel,
} from "./transaction-constants";
import { financialCategoryRulesSeed } from "../data/financial-category-rules.seed";
import { SYSTEM_FINANCE_CATEGORY_RULES } from "../data/finance-category-rules.config";
import { OFX_UNCLASSIFIED_CATEGORY } from "../services/ofx-import";

describe("transaction category labels — one PT-BR label per stored value", () => {
  it("gives every taxonomy slug exactly one label across all option lists", () => {
    const labelsBySlug = new Map<string, Set<string>>();
    for (const options of TRANSACTION_CATEGORY_OPTION_LISTS) {
      for (const { value, label } of options) {
        labelsBySlug.set(value, (labelsBySlug.get(value) ?? new Set()).add(label));
      }
    }
    const conflicts = [...labelsBySlug].filter(([, labels]) => labels.size > 1).map(([slug, labels]) => `${slug}: ${[...labels].join(" | ")}`);
    expect(conflicts).toEqual([]);
  });

  it("resolves the previously conflicting slugs to a single label (legacy and canonical spelling alike)", () => {
    expect(transactionCategoryLabel("design-grafico")).toBe("Design gráfico");
    expect(transactionCategoryLabel("graphic_design")).toBe("Design gráfico");
    expect(transactionCategoryLabel("direitos-autorais")).toBe("Direitos autorais");
    expect(transactionCategoryLabel("producao-audiovisual")).toBe("Produção audiovisual");
    expect(transactionCategoryLabel("locacao-equipamentos")).toBe("Locação de equipamentos");
    expect(transactionCategoryLabel("internet")).toBe("Internet");
  });

  it("shows rule-written display text as stored (form rule store and keyword rules)", () => {
    for (const rule of financialCategoryRulesSeed) {
      expect(transactionCategoryLabel(rule.category)).toBe(rule.category);
      if (rule.subcategory) expect(transactionCategoryLabel(rule.subcategory)).toBe(rule.subcategory);
    }
    for (const rule of SYSTEM_FINANCE_CATEGORY_RULES) {
      expect(transactionCategoryLabel(rule.categoryName)).toBe(rule.categoryName);
    }
  });

  it("never shows a raw slug for values outside the lists", () => {
    expect(transactionCategoryLabel("outra-coisa")).toBe("Outra Coisa");
    // folha_pagamento had a dead dictionary entry (never written); it is now just a humanized slug.
    expect(transactionCategoryLabel("folha_pagamento")).toBe("Folha Pagamento");
    expect(transactionCategoryLabel("")).toBe("Sem categoria");
    expect(transactionCategoryLabel(null)).toBe("Sem categoria");
  });
});

describe("Accounting category filter options", () => {
  const ruleCategories = [
    ...financialCategoryRulesSeed.map((rule) => rule.category),
    ...SYSTEM_FINANCE_CATEGORY_RULES.map((rule) => rule.categoryName),
  ];
  const options = buildTransactionCategoryFilterOptions(ruleCategories);
  const values = new Set(options.map((o) => o.value));

  it("includes every category the form rule store and the keyword rules can write", () => {
    for (const category of ruleCategories) expect(values.has(category)).toBe(true);
  });

  it("includes the OFX placeholder and every top-level taxonomy slug", () => {
    expect(values.has(OFX_UNCLASSIFIED_CATEGORY)).toBe(true);
    for (const slug of ["services", "music_revenue", "performance_fees", "equipment", "iss", "between_accounts"]) {
      expect(values.has(slug)).toBe(true);
    }
  });

  it("keeps labels unique (a slug colliding with rule text is marked as a previous classification)", () => {
    const labels = options.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(options.find((o) => o.value === "marketing")?.label).toBe(`Marketing${LEGACY_CATEGORY_SUFFIX}`);
    expect(options.find((o) => o.value === "Marketing")?.label).toBe("Marketing");
  });

  it("never offers a raw slug as a label", () => {
    for (const { label } of options) expect(label).not.toMatch(/^[a-z0-9_-]+$/);
  });
});
