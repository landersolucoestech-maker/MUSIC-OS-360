import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGACY_TRANSACTION_CATEGORY_SLUGS,
  LEGACY_UNCATEGORIZED_CATEGORY,
  UNCATEGORIZED_CATEGORY,
  UNCHANGED_TRANSACTION_CATEGORY_SLUGS,
  UNMAPPED_TRANSACTION_CATEGORY_SLUGS,
  canonicalTransactionSlug,
  sameTransactionSlug,
} from "./transaction-category-slugs";
import {
  TRANSACTION_CATEGORY_OPTION_LISTS,
  transactionCategoryLabel,
  getSubcategoriesForCategory,
  getInvestmentItemsByCategory,
  isMusicRevenueRequiringArtistAndProject,
  isServiceRequiringArtistAndProject,
  buildTransactionCategoryFilterOptions,
} from "./transaction-constants";
import { transactionToFormFields } from "../services/entity-to-form.mapper";
import { formToTransactionPayload } from "../services/form-to-payload.mapper";
import { computeFinancialRules } from "../components/transaction-form/rules/financial-form-rules";
import { initialFormData } from "./transaction-constants";
import { OFX_UNCLASSIFIED_CATEGORY } from "../services/ofx-import";
import { NATURE_BUCKETS, matchesNatureBucket } from "@/modules/artist/lib/revenue-nature";

/** Extracts a `'key': 'value'` object literal block / string-array literal from the API source file. */
const API_FILE = resolve(__dirname, "../../../../../api/src/modules/transactions/transaction-category-slugs.ts");
const apiSource = readFileSync(API_FILE, "utf8");

function apiMap(): Record<string, string> {
  const body = /LEGACY_TRANSACTION_CATEGORY_SLUGS: Readonly<Record<string, string>> = \{([\s\S]*?)\n\};/.exec(apiSource)![1];
  return Object.fromEntries([...body.matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
}
function apiList(name: string): string[] {
  const body = new RegExp(`${name}: readonly string\\[\\] = \\[([\\s\\S]*?)\\];`).exec(apiSource)![1];
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("transaction taxonomy slugs — web mirror parity with the API source (TX1)", () => {
  it("has exactly the API legacy -> canonical map", () => {
    expect(LEGACY_TRANSACTION_CATEGORY_SLUGS).toEqual(apiMap());
  });

  it("has the same unchanged / unmapped lists and placeholder as the API", () => {
    expect([...UNCHANGED_TRANSACTION_CATEGORY_SLUGS]).toEqual(apiList("UNCHANGED_TRANSACTION_CATEGORY_SLUGS"));
    expect([...UNMAPPED_TRANSACTION_CATEGORY_SLUGS]).toEqual(apiList("UNMAPPED_TRANSACTION_CATEGORY_SLUGS"));
    expect([...UNMAPPED_TRANSACTION_CATEGORY_SLUGS]).toEqual([]);
    expect(apiSource).toContain(`UNCATEGORIZED_CATEGORY = '${UNCATEGORIZED_CATEGORY}'`);
  });
});

describe("web and API legacy tables are identical, entry by entry (compat-coverage)", () => {
  const webEntries = Object.entries(LEGACY_TRANSACTION_CATEGORY_SLUGS);
  const apiEntries = Object.entries(apiMap());

  it("the API parse is complete: the regex captured every `'k': 'v'` line of the table (no silent drop)", () => {
    const body = /LEGACY_TRANSACTION_CATEGORY_SLUGS: Readonly<Record<string, string>> = \{([\s\S]*?)\n\};/.exec(apiSource)![1];
    const dataLines = body.split("\n").filter((l) => /^\s*['"][^'"]+['"]\s*:/.test(l));
    expect(apiEntries.length).toBe(dataLines.length);
    expect(apiEntries.length).toBeGreaterThan(100);
    expect(webEntries.length).toBe(apiEntries.length);
  });

  it("same keys, same canonical targets, same order", () => {
    expect(webEntries).toEqual(apiEntries);
  });

  it("every entry maps a legacy slug to a different canonical id, and canonical ids are never legacy keys", () => {
    for (const [legacy, canonical] of apiEntries) {
      expect(canonical, legacy).not.toBe(legacy);
      expect(Object.prototype.hasOwnProperty.call(LEGACY_TRANSACTION_CATEGORY_SLUGS, canonical), canonical).toBe(false);
    }
  });

  it("the legacy uncategorized placeholder is the same on both sides", () => {
    expect(apiSource).toContain(`LEGACY_UNCATEGORIZED_CATEGORY = '${LEGACY_UNCATEGORIZED_CATEGORY}'`);
    expect(canonicalTransactionSlug(LEGACY_UNCATEGORIZED_CATEGORY)).toBe(UNCATEGORIZED_CATEGORY);
  });
});

describe("transaction option lists — canonical values, unchanged PT-BR labels", () => {
  const all = TRANSACTION_CATEGORY_OPTION_LISTS.flat();
  const canonicalIds = new Set(Object.values(LEGACY_TRANSACTION_CATEGORY_SLUGS));
  const reserved = new Set<string>([...UNCHANGED_TRANSACTION_CATEGORY_SLUGS, ...UNMAPPED_TRANSACTION_CATEGORY_SLUGS]);

  it("no option writes a legacy slug; every value is canonical or an unchanged English slug (no unmapped slug remains)", () => {
    for (const { value } of all) {
      expect(Object.prototype.hasOwnProperty.call(LEGACY_TRANSACTION_CATEGORY_SLUGS, value), value).toBe(false);
      expect(canonicalIds.has(value) || reserved.has(value), value).toBe(true);
    }
  });

  it("every canonical id of the map is offered by some option list (the registry covers the whole map)", () => {
    const offered = new Set(all.map((o) => o.value));
    const missing = [...canonicalIds].filter((id) => !offered.has(id) && id !== "external_rights_receipts");
    expect(missing).toEqual([]);
    expect(offered.has("external_rights_receipts")).toBe(true);
  });

  it("each legacy slug renders the SAME PT-BR label as its canonical id (user-visible text preserved)", () => {
    const labelOf = new Map(all.map((o) => [o.value, o.label]));
    for (const [legacy, canonical] of Object.entries(LEGACY_TRANSACTION_CATEGORY_SLUGS)) {
      if (legacy === "external-rights-receipts" || legacy === "recebimentos-externos-streaming") continue; // seed / API-only spellings, no web option
      expect(transactionCategoryLabel(legacy), legacy).toBe(labelOf.get(canonical));
      expect(transactionCategoryLabel(canonical), canonical).toBe(labelOf.get(canonical));
    }
    expect(transactionCategoryLabel("outros")).toBe("Outros");
    expect(transactionCategoryLabel("recebimentos-externos-streaming")).toBe("Recebimentos externos de streaming");
  });

  it("preserves the exact labels of representative options", () => {
    expect(transactionCategoryLabel("music_revenue")).toBe("Receitas Musicais");
    expect(transactionCategoryLabel("receitas-musicais")).toBe("Receitas Musicais");
    expect(transactionCategoryLabel("show_fee")).toBe("Cachê de show");
    expect(transactionCategoryLabel("performance_fees")).toBe("Cachês");
    expect(transactionCategoryLabel("simples_nacional")).toBe("Simples Nacional");
    expect(transactionCategoryLabel("receitas-internas")).toBe("Receitas Internas");
    expect(transactionCategoryLabel("repasse-contrato")).toBe("Repasse de Contrato");
    expect(transactionCategoryLabel("internal_revenue")).toBe("Receitas Internas");
    expect(transactionCategoryLabel("contract_pass_through")).toBe("Repasse de Contrato");
    expect(canonicalTransactionSlug("receitas-internas")).toBe("internal_revenue");
    expect(canonicalTransactionSlug("repasse-contrato")).toBe("contract_pass_through");
  });

  it("free text is never rewritten", () => {
    expect(canonicalTransactionSlug("Receitas Musicais")).toBe("Receitas Musicais");
    expect(canonicalTransactionSlug("Outros")).toBe("Outros");
    expect(transactionCategoryLabel("Receitas Musicais")).toBe("Receitas Musicais");
  });

  it("subcategory lookups and business-rule checkers accept both spellings", () => {
    for (const category of ["receitas-musicais", "music_revenue"]) {
      expect(getSubcategoriesForCategory("revenue", "company", category).length).toBeGreaterThan(0);
    }
    expect(getSubcategoriesForCategory("expense", "artist", "caches").map((o) => o.value)).toEqual(["show_event", "advertising"]);
    expect(getSubcategoriesForCategory("expense", "artist", "performance_fees").map((o) => o.value)).toEqual(["show_event", "advertising"]);
    expect(getInvestmentItemsByCategory("formacao").length).toBeGreaterThan(0);
    expect(getInvestmentItemsByCategory("training").length).toBeGreaterThan(0);
    expect(isMusicRevenueRequiringArtistAndProject("direitos-autorais")).toBe(true);
    expect(isMusicRevenueRequiringArtistAndProject("copyright")).toBe(true);
    expect(isServiceRequiringArtistAndProject("design-grafico")).toBe(true);
  });

  it("sameTransactionSlug equates the spellings; the filter options offer the canonical value once", () => {
    expect(sameTransactionSlug("receitas-musicais", "music_revenue")).toBe(true);
    expect(sameTransactionSlug("services", "music_revenue")).toBe(false);
    expect(sameTransactionSlug(null, "x")).toBe(false);
    const options = buildTransactionCategoryFilterOptions(["receitas-musicais", "Marketing"]);
    expect(options.filter((o) => o.value === "music_revenue")).toHaveLength(1);
    expect(options.some((o) => o.value === "receitas-musicais")).toBe(false);
  });
});

describe("readers accept both spellings (TX1)", () => {
  it("a stored row with legacy slugs hydrates the edit form canonical, and the payload is canonical", () => {
    const form = transactionToFormFields({ category: "receitas-musicais", subcategory: "direitos-autorais" });
    expect(form.category).toBe("music_revenue");
    expect(form.subcategory).toBe("copyright");
    const payload = formToTransactionPayload({ ...initialFormData, ...form, transactionType: "revenue", counterpartyType: "company", amount: "10", transactionDate: "2026-01-01" });
    expect(payload.category).toBe("music_revenue");
    expect(payload.subcategory).toBe("copyright");
    expect(formToTransactionPayload({ ...initialFormData, category: "Receitas Musicais", transactionType: "revenue", counterpartyType: "company", amount: "10", transactionDate: "2026-01-01" }).category).toBe("Receitas Musicais");
  });

  it("form visibility rules give the same result for the legacy and the canonical spelling", () => {
    const pairs: Array<[Partial<typeof initialFormData>, Partial<typeof initialFormData>]> = [
      [{ transactionType: "revenue", counterpartyType: "company", category: "receitas-musicais", subcategory: "venda-show-fechado" },
       { transactionType: "revenue", counterpartyType: "company", category: "music_revenue", subcategory: "closed_show_sale" }],
      [{ transactionType: "expense", counterpartyType: "artist", category: "caches", subcategory: "publicidade" },
       { transactionType: "expense", counterpartyType: "artist", category: "performance_fees", subcategory: "advertising" }],
      [{ transactionType: "expense", counterpartyType: "company", category: "servicos", subcategory: "design-grafico" },
       { transactionType: "expense", counterpartyType: "company", category: "services", subcategory: "graphic_design" }],
      [{ transactionType: "expense", counterpartyType: "company", category: "viagens", subcategory: "passagens" },
       { transactionType: "expense", counterpartyType: "company", category: "travel", subcategory: "travel_tickets" }],
    ];
    for (const [legacy, canonical] of pairs) {
      const a = computeFinancialRules({ ...initialFormData, ...legacy });
      const b = computeFinancialRules({ ...initialFormData, ...canonical });
      expect(a).toEqual(b);
    }
    expect(computeFinancialRules({ ...initialFormData, transactionType: "revenue", counterpartyType: "company", category: "music_revenue", subcategory: "closed_show_sale" }).showEvent).toBe(true);
    expect(computeFinancialRules({ ...initialFormData, transactionType: "expense", counterpartyType: "artist", category: "performance_fees", subcategory: "advertising" }).showAdvertisingName).toBe(true);
  });

  it("the OFX placeholder is the canonical uncategorized id", () => {
    expect(OFX_UNCLASSIFIED_CATEGORY).toBe("other");
  });

  it("artist 360 revenue buckets classify the legacy and the canonical spelling identically", () => {
    const bucketOf = (category: string) => NATURE_BUCKETS.filter((b) => matchesNatureBucket(b, category)).map((b) => b.label);
    const pairs: Array<[string, string]> = [
      ["cache-show", "show_fee"], ["licenciamento", "licensing"], ["licenciamento-obra", "work_licensing"],
      ["licenciamento-fonograma", "phonogram_licensing"], ["sincronizacao", "synchronization"], ["patrocinio", "sponsorship"],
      ["publicidade", "advertising"], ["anuncios", "ads"], ["participacao-show-evento", "show_event_participation"],
      ["venda-show-fechado", "closed_show_sale"], ["direitos-autorais", "copyright"], ["outros", "other"],
    ];
    for (const [legacy, canonical] of pairs) expect(bucketOf(canonical), canonical).toEqual(bucketOf(legacy));
    expect(bucketOf("show_fee")).toEqual(["Shows"]);
    expect(bucketOf("sponsorship")).toEqual(["Publicidade"]);
  });
});
