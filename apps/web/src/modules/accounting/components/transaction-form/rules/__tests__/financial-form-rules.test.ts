import { describe, it, expect } from "vitest";
import { computeFinancialRules } from "../financial-form-rules";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

const base: TransactionFormData = {
  entityLinks: [],
  transactionType: "",
  counterpartyType: "",
  category: "",
  subcategory: "",
  description: "",
  amount: "",
  transactionDate: "",
  status: "pending",
  notes: "",
  artistId: "",
  projectId: "",
  contractId: "",
  eventId: "",
  counterpartyName: "",
  taxAuthority: "",
  investmentItem: "",
  travelReason: "",
  advertisingName: "",
  paymentMethod: "",
  paymentType: "upfront",
  installmentCount: "",
  installmentInterval: "monthly",
  firstInstallmentDate: "",
  attachmentUrl: "",
  attachmentName: "",
};

function form(overrides: Partial<TransactionFormData>): TransactionFormData {
  return { ...base, ...overrides };
}

// ── showClientType ──────────────────────────────────────────────────────
describe("showClientType", () => {
  it("is false when transactionType is empty", () => {
    const rules = computeFinancialRules(form({ transactionType: "" }));
    expect(rules.showClientType).toBe(false);
  });

  it("is true for expense", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense" }));
    expect(rules.showClientType).toBe(true);
  });

  it("is true for revenue", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue" }));
    expect(rules.showClientType).toBe(true);
  });

  it("is false for tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.showClientType).toBe(false);
  });

  it("is false for transfer", () => {
    const rules = computeFinancialRules(form({ transactionType: "transfer" }));
    expect(rules.showClientType).toBe(false);
  });

  it("is false for investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.showClientType).toBe(false);
  });
});

// ── showCategory ────────────────────────────────────────────────────────
describe("showCategory", () => {
  it("is false when transactionType is empty", () => {
    const rules = computeFinancialRules(form({}));
    expect(rules.showCategory).toBe(false);
  });

  it("is true for tax (no counterpartyType needed)", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.showCategory).toBe(true);
  });

  it("is true for transfer (no counterpartyType needed)", () => {
    const rules = computeFinancialRules(form({ transactionType: "transfer" }));
    expect(rules.showCategory).toBe(true);
  });

  it("is true for investment (no counterpartyType needed)", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.showCategory).toBe(true);
  });

  it("is true for expense + company", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company" }));
    expect(rules.showCategory).toBe(true);
  });

  it("is true for revenue + company", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue", counterpartyType: "company" }));
    expect(rules.showCategory).toBe(true);
  });

  it("is false for expense without counterpartyType", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense" }));
    expect(rules.showCategory).toBe(false);
  });
});

// ── showSubcategory ─────────────────────────────────────────────────────
describe("showSubcategory", () => {
  it("is false when no matching subcategories exist", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax", category: "irrf" }));
    expect(rules.showSubcategory).toBe(false);
  });

  it("is true for expense company services", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company", category: "services",
    }));
    expect(rules.showSubcategory).toBe(true);
  });

  it("is true for expense artist performance_fees", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist", category: "performance_fees",
    }));
    expect(rules.showSubcategory).toBe(true);
  });

  it("is true for revenue company music_revenue", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company", category: "music_revenue",
    }));
    expect(rules.showSubcategory).toBe(true);
  });

  it("is false for expense artist financial_support (no subcategories)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist", category: "financial_support",
    }));
    expect(rules.showSubcategory).toBe(false);
  });
});

// ── showInvestmentItem ─────────────────────────────────────────────────
describe("showInvestmentItem", () => {
  it("is false when not investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", category: "equipment" }));
    expect(rules.showInvestmentItem).toBe(false);
  });

  it("is false for investment without category", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.showInvestmentItem).toBe(false);
  });

  it("is true for investment + equipment", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "equipment" }));
    expect(rules.showInvestmentItem).toBe(true);
  });

  it("is true for investment + technology", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "technology" }));
    expect(rules.showInvestmentItem).toBe(true);
  });

  it("is true for investment + marketing", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "marketing" }));
    expect(rules.showInvestmentItem).toBe(true);
  });

  it("is true for investment + training", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "training" }));
    expect(rules.showInvestmentItem).toBe(true);
  });

  it("is true for investment + infrastructure", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "infrastructure" }));
    expect(rules.showInvestmentItem).toBe(true);
  });
});

// ── showArtist ──────────────────────────────────────────────────────────
describe("showArtist", () => {
  it("is false for plain tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.showArtist).toBe(false);
  });

  it("is true for expense company services + graphic_design (expenseServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "services", subcategory: "graphic_design",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is false for expense company services + legal_advisory (not in expenseServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "services", subcategory: "legal_advisory",
    }));
    expect(rules.showArtist).toBe(false);
  });

  it("is true for expense company marketing + any subcategory", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "ads",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is false for expense company marketing without subcategory", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "",
    }));
    expect(rules.showArtist).toBe(false);
  });

  it("is true for expense company travel + travel_tickets", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "travel", subcategory: "travel_tickets",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for expense company products + equipment", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "products", subcategory: "equipment",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for expense company financial_support (no subcategory needed)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "financial_support",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for expense artist performance_fees + show_event", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "performance_fees", subcategory: "show_event",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for expense artist financial_support (no subcategory needed)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "financial_support",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for revenue company music_revenue + external_rights_streaming", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "music_revenue", subcategory: "external_rights_streaming",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for revenue company services + music_production (revenueServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "services", subcategory: "music_production",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for revenue company services + website_creation (revenueServicesRequiringArtistOnly)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "services", subcategory: "website_creation",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is false for revenue company services + consulting (not in either list)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "services", subcategory: "consulting",
    }));
    expect(rules.showArtist).toBe(false);
  });

  it("is true for revenue company products + merchandise_sales", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "products", subcategory: "merchandise_sales",
    }));
    expect(rules.showArtist).toBe(true);
  });
});

// ── showProject ──────────────────────────────────────────────────────────
describe("showProject", () => {
  it("is true for expense company services + graphic_design", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "services", subcategory: "graphic_design",
    }));
    expect(rules.showProject).toBe(true);
  });

  it("is false for expense company services + legal_advisory", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "services", subcategory: "legal_advisory",
    }));
    expect(rules.showProject).toBe(false);
  });

  it("is true for expense company marketing + subcategory + artistId", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "ads", artistId: "artist-1",
    }));
    expect(rules.showProject).toBe(true);
  });

  it("is false for expense company marketing without artistId", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "ads",
    }));
    expect(rules.showProject).toBe(false);
  });

  it("is true for revenue company music_revenue + copyright", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "music_revenue", subcategory: "copyright",
    }));
    expect(rules.showProject).toBe(true);
  });

  it("is false for revenue company music_revenue + show_event_participation (not in musicRevenueRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "music_revenue", subcategory: "show_event_participation",
    }));
    expect(rules.showProject).toBe(false);
  });

  it("is true for revenue company services + music_production", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "services", subcategory: "music_production",
    }));
    expect(rules.showProject).toBe(true);
  });

  it("is false for revenue company services + website_creation (artist only, no project)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "services", subcategory: "website_creation",
    }));
    expect(rules.showProject).toBe(false);
  });
});

// ── projectRequired ─────────────────────────────────────────────────────
describe("projectRequired", () => {
  it("is true for expense company services + graphic_design", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "services", subcategory: "graphic_design",
    }));
    expect(rules.projectRequired).toBe(true);
  });

  it("is false for expense company marketing (artist optional, project conditional)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "ads",
    }));
    expect(rules.projectRequired).toBe(false);
  });

  it("is true for revenue company music_revenue + external_rights_streaming", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "music_revenue", subcategory: "external_rights_streaming",
    }));
    expect(rules.projectRequired).toBe(true);
  });

  it("is false for revenue company music_revenue + show_event_participation", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "music_revenue", subcategory: "show_event_participation",
    }));
    expect(rules.projectRequired).toBe(false);
  });

  it("is true for revenue company services + music_production", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "services", subcategory: "music_production",
    }));
    expect(rules.projectRequired).toBe(true);
  });

  it("is false for revenue company services + website_creation", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "services", subcategory: "website_creation",
    }));
    expect(rules.projectRequired).toBe(false);
  });
});

// ── showEvent ───────────────────────────────────────────────────────────
describe("showEvent", () => {
  it("is false when nothing relevant is selected", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense" }));
    expect(rules.showEvent).toBe(false);
  });

  it("is true for expense company products + set_design_pyrotechnics", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "products", subcategory: "set_design_pyrotechnics",
    }));
    expect(rules.showEvent).toBe(true);
  });

  it("is false for expense company products + equipment (not in expenseProductsRequiringEvent)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "products", subcategory: "equipment",
    }));
    expect(rules.showEvent).toBe(false);
  });

  it("is true for expense artist performance_fees + show_event", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "performance_fees", subcategory: "show_event",
    }));
    expect(rules.showEvent).toBe(true);
  });

  it("is false for expense artist performance_fees + advertising", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "performance_fees", subcategory: "advertising",
    }));
    expect(rules.showEvent).toBe(false);
  });

  it("is true for revenue company music_revenue + show_event_participation", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "music_revenue", subcategory: "show_event_participation",
    }));
    expect(rules.showEvent).toBe(true);
  });

  it("is true for revenue company music_revenue + closed_show_sale", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "music_revenue", subcategory: "closed_show_sale",
    }));
    expect(rules.showEvent).toBe(true);
  });

  it("is false for revenue company music_revenue + copyright", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "music_revenue", subcategory: "copyright",
    }));
    expect(rules.showEvent).toBe(false);
  });
});

// ── showSupplier ───────────────────────────────────────────────────────
describe("showSupplier", () => {
  it("is false for tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.showSupplier).toBe(false);
  });

  it("is false for investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.showSupplier).toBe(false);
  });

  it("is true for expense company", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company" }));
    expect(rules.showSupplier).toBe(true);
  });

  it("is true for expense individual", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "individual" }));
    expect(rules.showSupplier).toBe(true);
  });

  it("is false for expense artist", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "artist" }));
    expect(rules.showSupplier).toBe(false);
  });

  it("is true for revenue company", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue", counterpartyType: "company" }));
    expect(rules.showSupplier).toBe(true);
  });

  it("is false for revenue artist", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue", counterpartyType: "artist" }));
    expect(rules.showSupplier).toBe(false);
  });
});

// ── showCollectingAgency ─────────────────────────────────────────────────
describe("showCollectingAgency", () => {
  it("is true for tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.showCollectingAgency).toBe(true);
  });

  it("is false for any other type", () => {
    for (const t of ["expense", "revenue", "investment", "transfer"]) {
      const rules = computeFinancialRules(form({ transactionType: t }));
      expect(rules.showCollectingAgency).toBe(false);
    }
  });
});

// ── showTravelReason ─────────────────────────────────────────────────────
describe("showTravelReason", () => {
  it("is false when not expense viagem", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company", category: "services", subcategory: "graphic_design" }));
    expect(rules.showTravelReason).toBe(false);
  });

  it("is false for expense company travel without subcategory", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company", category: "travel" }));
    expect(rules.showTravelReason).toBe(false);
  });

  it("is true for expense company travel + travel_tickets", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "travel", subcategory: "travel_tickets",
    }));
    expect(rules.showTravelReason).toBe(true);
  });

  it("is true for expense individual travel + lodging", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "individual",
      category: "travel", subcategory: "lodging",
    }));
    expect(rules.showTravelReason).toBe(true);
  });
});

// ── showAdvertisingName ──────────────────────────────────────────────────
describe("showAdvertisingName", () => {
  it("is false for non-artist performance_fees advertising scenarios", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "artist", category: "performance_fees", subcategory: "show_event" }));
    expect(rules.showAdvertisingName).toBe(false);
  });

  it("is true for expense artist performance_fees + advertising", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "performance_fees", subcategory: "advertising",
    }));
    expect(rules.showAdvertisingName).toBe(true);
  });

  it("is false for expense company marketing (not artist performance_fees)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "ads",
    }));
    expect(rules.showAdvertisingName).toBe(false);
  });
});

// ── showInstallments ─────────────────────────────────────────────────────
describe("showInstallments", () => {
  it("is false when paymentType is upfront", () => {
    const rules = computeFinancialRules(form({ paymentType: "upfront" }));
    expect(rules.showInstallments).toBe(false);
  });

  it("is true when paymentType is installments", () => {
    const rules = computeFinancialRules(form({ paymentType: "installments" }));
    expect(rules.showInstallments).toBe(true);
  });
});

// ── clientTypeLabel ───────────────────────────────────────────────────────
describe("clientTypeLabel", () => {
  it("returns 'Pagar quem' for expense", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense" }));
    expect(rules.clientTypeLabel).toBe("Pagar quem");
  });

  it("returns 'Receber de' for revenue", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue" }));
    expect(rules.clientTypeLabel).toBe("Receber de");
  });

  it("returns 'Tipo de Cliente' for tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.clientTypeLabel).toBe("Tipo de Cliente");
  });

  it("returns 'Tipo de Cliente' for investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.clientTypeLabel).toBe("Tipo de Cliente");
  });

  it("returns 'Tipo de Cliente' for empty transactionType", () => {
    const rules = computeFinancialRules(form({}));
    expect(rules.clientTypeLabel).toBe("Tipo de Cliente");
  });
});


// Legacy readers: rows not yet reached by migration 20260930000018 still hold the old
// kebab-case Portuguese slugs; they must behave exactly like their canonical twins.
describe("computeFinancialRules - legacy slug read-compat", () => {
  const LEGACY_AND_CANONICAL: ReadonlyArray<[string, string, string, string]> = [
    ["servicos", "design-grafico", "services", "graphic_design"],
    ["produtos", "cenografia-pirotecnia", "products", "set_design_pyrotechnics"],
    ["caches", "show-evento", "performance_fees", "show_event"],
  ];
  it.each(LEGACY_AND_CANONICAL)("treats %s + %s like %s + %s", (legacyCategory, legacySubcategory, category, subcategory) => {
    const common = { transactionType: "expense", counterpartyType: legacyCategory === "caches" ? "artist" : "company" } as const;
    const legacy = computeFinancialRules(form({ ...common, category: legacyCategory, subcategory: legacySubcategory }));
    const canonical = computeFinancialRules(form({ ...common, category, subcategory }));
    expect(legacy).toEqual(canonical);
  });
});
