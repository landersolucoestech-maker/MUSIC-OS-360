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

  it("is true for expense company servicos", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company", category: "servicos",
    }));
    expect(rules.showSubcategory).toBe(true);
  });

  it("is true for expense artist caches", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist", category: "caches",
    }));
    expect(rules.showSubcategory).toBe(true);
  });

  it("is true for revenue company receitas-musicais", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company", category: "receitas-musicais",
    }));
    expect(rules.showSubcategory).toBe(true);
  });

  it("is false for expense artist suporte-financeiro (no subcategories)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist", category: "suporte-financeiro",
    }));
    expect(rules.showSubcategory).toBe(false);
  });
});

// ── showInvestmentItem ─────────────────────────────────────────────────
describe("showInvestmentItem", () => {
  it("is false when not investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", category: "equipamentos" }));
    expect(rules.showInvestmentItem).toBe(false);
  });

  it("is false for investment without category", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.showInvestmentItem).toBe(false);
  });

  it("is true for investment + equipamentos", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "equipamentos" }));
    expect(rules.showInvestmentItem).toBe(true);
  });

  it("is true for investment + tecnologia", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "tecnologia" }));
    expect(rules.showInvestmentItem).toBe(true);
  });

  it("is true for investment + marketing", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "marketing" }));
    expect(rules.showInvestmentItem).toBe(true);
  });

  it("is true for investment + formacao", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "formacao" }));
    expect(rules.showInvestmentItem).toBe(true);
  });

  it("is true for investment + infraestrutura", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "infraestrutura" }));
    expect(rules.showInvestmentItem).toBe(true);
  });
});

// ── showArtist ──────────────────────────────────────────────────────────
describe("showArtist", () => {
  it("is false for plain tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.showArtist).toBe(false);
  });

  it("is true for expense company servicos + design-grafico (expenseServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "design-grafico",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is false for expense company servicos + assessoria-juridica (not in expenseServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "assessoria-juridica",
    }));
    expect(rules.showArtist).toBe(false);
  });

  it("is true for expense company marketing + any subcategory", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios",
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

  it("is true for expense company viagens + passagens", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "viagens", subcategory: "passagens",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for expense company produtos + equipamentos", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "produtos", subcategory: "equipamentos",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for expense company suporte-financeiro (no subcategory needed)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "suporte-financeiro",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for expense artist caches + show-evento", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "caches", subcategory: "show-evento",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for expense artist suporte-financeiro (no subcategory needed)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "suporte-financeiro",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for revenue company receitas-musicais + external-rights-streaming", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "external-rights-streaming",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for revenue company servicos + producao-musical (revenueServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "producao-musical",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is true for revenue company servicos + criacao-site (revenueServicesRequiringArtistOnly)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "criacao-site",
    }));
    expect(rules.showArtist).toBe(true);
  });

  it("is false for revenue company servicos + consultoria (not in either list)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "consultoria",
    }));
    expect(rules.showArtist).toBe(false);
  });

  it("is true for revenue company produtos + venda-merchandising", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "produtos", subcategory: "venda-merchandising",
    }));
    expect(rules.showArtist).toBe(true);
  });
});

// ── showProject ──────────────────────────────────────────────────────────
describe("showProject", () => {
  it("is true for expense company servicos + design-grafico", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "design-grafico",
    }));
    expect(rules.showProject).toBe(true);
  });

  it("is false for expense company servicos + assessoria-juridica", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "assessoria-juridica",
    }));
    expect(rules.showProject).toBe(false);
  });

  it("is true for expense company marketing + subcategory + artistId", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios", artistId: "artista-1",
    }));
    expect(rules.showProject).toBe(true);
  });

  it("is false for expense company marketing without artistId", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios",
    }));
    expect(rules.showProject).toBe(false);
  });

  it("is true for revenue company receitas-musicais + direitos-autorais", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "direitos-autorais",
    }));
    expect(rules.showProject).toBe(true);
  });

  it("is false for revenue company receitas-musicais + participacao-show-evento (not in musicRevenueRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "participacao-show-evento",
    }));
    expect(rules.showProject).toBe(false);
  });

  it("is true for revenue company servicos + producao-musical", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "producao-musical",
    }));
    expect(rules.showProject).toBe(true);
  });

  it("is false for revenue company servicos + criacao-site (artist only, no project)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "criacao-site",
    }));
    expect(rules.showProject).toBe(false);
  });
});

// ── projectRequired ─────────────────────────────────────────────────────
describe("projectRequired", () => {
  it("is true for expense company servicos + design-grafico", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "design-grafico",
    }));
    expect(rules.projectRequired).toBe(true);
  });

  it("is false for expense company marketing (artist optional, project conditional)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios",
    }));
    expect(rules.projectRequired).toBe(false);
  });

  it("is true for revenue company receitas-musicais + external-rights-streaming", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "external-rights-streaming",
    }));
    expect(rules.projectRequired).toBe(true);
  });

  it("is false for revenue company receitas-musicais + participacao-show-evento", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "participacao-show-evento",
    }));
    expect(rules.projectRequired).toBe(false);
  });

  it("is true for revenue company servicos + producao-musical", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "producao-musical",
    }));
    expect(rules.projectRequired).toBe(true);
  });

  it("is false for revenue company servicos + criacao-site", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "criacao-site",
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

  it("is true for expense company produtos + cenografia-pirotecnia", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "produtos", subcategory: "cenografia-pirotecnia",
    }));
    expect(rules.showEvent).toBe(true);
  });

  it("is false for expense company produtos + equipamentos (not in expenseProductsRequiringEvent)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "produtos", subcategory: "equipamentos",
    }));
    expect(rules.showEvent).toBe(false);
  });

  it("is true for expense artist caches + show-evento", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "caches", subcategory: "show-evento",
    }));
    expect(rules.showEvent).toBe(true);
  });

  it("is false for expense artist caches + publicidade", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "caches", subcategory: "publicidade",
    }));
    expect(rules.showEvent).toBe(false);
  });

  it("is true for revenue company receitas-musicais + participacao-show-evento", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "participacao-show-evento",
    }));
    expect(rules.showEvent).toBe(true);
  });

  it("is true for revenue company receitas-musicais + venda-show-fechado", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "venda-show-fechado",
    }));
    expect(rules.showEvent).toBe(true);
  });

  it("is false for revenue company receitas-musicais + direitos-autorais", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "direitos-autorais",
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
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company", category: "servicos", subcategory: "design-grafico" }));
    expect(rules.showTravelReason).toBe(false);
  });

  it("is false for expense company viagens without subcategory", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company", category: "viagens" }));
    expect(rules.showTravelReason).toBe(false);
  });

  it("is true for expense company viagens + passagens", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "viagens", subcategory: "passagens",
    }));
    expect(rules.showTravelReason).toBe(true);
  });

  it("is true for expense individual viagens + hospedagem", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "individual",
      category: "viagens", subcategory: "hospedagem",
    }));
    expect(rules.showTravelReason).toBe(true);
  });
});

// ── showAdvertisingName ──────────────────────────────────────────────────
describe("showAdvertisingName", () => {
  it("is false for non-artist caches publicidade scenarios", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "artist", category: "caches", subcategory: "show-evento" }));
    expect(rules.showAdvertisingName).toBe(false);
  });

  it("is true for expense artist caches + publicidade", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "caches", subcategory: "publicidade",
    }));
    expect(rules.showAdvertisingName).toBe(true);
  });

  it("is false for expense company marketing (not artist caches)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios",
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

