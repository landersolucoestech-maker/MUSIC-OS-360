/**
 * Consumer wiring of the credited legacy-compat code in financial-form-rules.ts:
 * a stored row that still holds a legacy Portuguese slug behaves like its canonical twin, and the
 * catalog lookups (not just their argument) decide whether a select is shown.
 */
import { describe, expect, it } from "vitest";
import { computeFinancialRules } from "../financial-form-rules";
import { initialFormData, type TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

function form(overrides: Partial<TransactionFormData>): TransactionFormData {
  return { ...initialFormData, ...overrides };
}

// Legacy kebab slugs written as computed table values (no inline identifiers).
const REVENUE_SERVICE = { transactionType: "revenue", counterpartyType: "company", category: "servicos" } as const;
const MUSIC_REVENUE = { transactionType: "revenue", counterpartyType: "company", category: "receitas-musicais" } as const;

describe("financial-form-rules: legacy subcategory slugs behave like their canonical twin", () => {
  it.each([
    ["gravacao-estudio", "studio_recording"],
    ["producao-musical", "music_production"],
    ["mixagem", "mixing"],
  ])("revenue service %s (= %s) shows artist and project and requires the project", (legacy, canonical) => {
    const legacyRules = computeFinancialRules(form({ ...REVENUE_SERVICE, subcategory: legacy }));
    const canonicalRules = computeFinancialRules(form({ ...REVENUE_SERVICE, category: "services", subcategory: canonical }));
    expect(legacyRules.showArtist).toBe(true);
    expect(legacyRules.showProject).toBe(true);
    expect(legacyRules.projectRequired).toBe(true);
    expect(legacyRules).toEqual(canonicalRules);
  });

  it("revenue service 'ensaio' (= rehearsal, artist only) shows the artist but never the project", () => {
    const rules = computeFinancialRules(form({ ...REVENUE_SERVICE, subcategory: "ensaio" }));
    expect(rules.showArtist).toBe(true);
    expect(rules.showProject).toBe(false);
    expect(rules.projectRequired).toBe(false);
  });

  it.each([
    ["direitos-conexos", "neighboring_rights"],
    ["sincronizacao", "synchronization"],
    ["venda-beats", "beat_sales"],
  ])("music revenue %s (= %s) shows artist and project and requires the project", (legacy, canonical) => {
    const legacyRules = computeFinancialRules(form({ ...MUSIC_REVENUE, subcategory: legacy }));
    const canonicalRules = computeFinancialRules(form({ ...MUSIC_REVENUE, category: "music_revenue", subcategory: canonical }));
    expect(legacyRules.showArtist).toBe(true);
    expect(legacyRules.showProject).toBe(true);
    expect(legacyRules.projectRequired).toBe(true);
    expect(legacyRules).toEqual(canonicalRules);
  });

  it("music revenue artist-only legacy slug does not require a project", () => {
    const rules = computeFinancialRules(form({ ...MUSIC_REVENUE, subcategory: "participacao-show-evento" }));
    expect(rules.showArtist).toBe(true);
    expect(rules.showEvent).toBe(true);
    expect(rules.showProject).toBe(false);
    expect(rules.projectRequired).toBe(false);
  });

  it("negative: a revenue service outside the artist lists shows neither artist nor project", () => {
    for (const subcategory of ["consultoria", "locacao-estudio", "consulting", "not-a-slug", ""]) {
      const rules = computeFinancialRules(form({ ...REVENUE_SERVICE, subcategory }));
      expect(rules.showArtist).toBe(false);
      expect(rules.showProject).toBe(false);
      expect(rules.projectRequired).toBe(false);
    }
  });

  it("negative: a music revenue outside the lists shows neither project nor requirement", () => {
    for (const subcategory of ["receitas-contratuais", "not-a-slug"]) {
      const rules = computeFinancialRules(form({ ...MUSIC_REVENUE, subcategory }));
      expect(rules.showProject).toBe(false);
      expect(rules.projectRequired).toBe(false);
    }
  });
});

describe("financial-form-rules: catalog lookups gate the selects (negative cases)", () => {
  it("showCategory is true only when the type/counterparty pair has categories", () => {
    expect(computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company" })).showCategory).toBe(true);
    expect(computeFinancialRules(form({ transactionType: "revenue", counterpartyType: "artist" })).showCategory).toBe(true);
  });

  it.each([
    ["expense", "unknown_party"],
    ["revenue", "government"],
    ["unknown_type", "company"],
    ["revenue", "supplier"],
  ])("showCategory is false for %s / %s (no category list)", (transactionType, counterpartyType) => {
    expect(computeFinancialRules(form({ transactionType, counterpartyType })).showCategory).toBe(false);
  });

  it("showSubcategory follows the subcategory list of the (legacy) category", () => {
    expect(computeFinancialRules(form({ ...REVENUE_SERVICE })).showSubcategory).toBe(true);
    expect(computeFinancialRules(form({ ...REVENUE_SERVICE, category: "outros" })).showSubcategory).toBe(false);
    expect(computeFinancialRules(form({ ...REVENUE_SERVICE, category: "unknown_category" })).showSubcategory).toBe(false);
  });

  it.each(["tecnologia", "technology", "equipamentos", "infraestrutura", "formacao"])(
    "investment with category %s shows the item select",
    (category) => {
      expect(computeFinancialRules(form({ transactionType: "investment", category })).showInvestmentItem).toBe(true);
    },
  );

  it.each(["unknown_category", "outros", "servicos", "not-a-slug"])(
    "investment with category %s (no item list) hides the item select",
    (category) => {
      expect(computeFinancialRules(form({ transactionType: "investment", category })).showInvestmentItem).toBe(false);
    },
  );

  it("investment without a category hides the item select", () => {
    expect(computeFinancialRules(form({ transactionType: "investment", category: "" })).showInvestmentItem).toBe(false);
  });

  it("a non-investment type never shows the item select even with an item-bearing category", () => {
    expect(computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company", category: "tecnologia" })).showInvestmentItem).toBe(false);
  });
});
