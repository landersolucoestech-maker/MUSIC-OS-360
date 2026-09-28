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

// ── exibirTipoCliente ──────────────────────────────────────────────────────
describe("exibirTipoCliente", () => {
  it("is false when transactionType is empty", () => {
    const rules = computeFinancialRules(form({ transactionType: "" }));
    expect(rules.exibirTipoCliente).toBe(false);
  });

  it("is true for expense", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense" }));
    expect(rules.exibirTipoCliente).toBe(true);
  });

  it("is true for revenue", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue" }));
    expect(rules.exibirTipoCliente).toBe(true);
  });

  it("is false for tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.exibirTipoCliente).toBe(false);
  });

  it("is false for transfer", () => {
    const rules = computeFinancialRules(form({ transactionType: "transfer" }));
    expect(rules.exibirTipoCliente).toBe(false);
  });

  it("is false for investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.exibirTipoCliente).toBe(false);
  });
});

// ── exibirCategoria ────────────────────────────────────────────────────────
describe("exibirCategoria", () => {
  it("is false when transactionType is empty", () => {
    const rules = computeFinancialRules(form({}));
    expect(rules.exibirCategoria).toBe(false);
  });

  it("is true for tax (no counterpartyType needed)", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is true for transfer (no counterpartyType needed)", () => {
    const rules = computeFinancialRules(form({ transactionType: "transfer" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is true for investment (no counterpartyType needed)", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is true for expense + company", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is true for revenue + company", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue", counterpartyType: "company" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is false for expense without counterpartyType", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense" }));
    expect(rules.exibirCategoria).toBe(false);
  });
});

// ── exibirSubcategoria ─────────────────────────────────────────────────────
describe("exibirSubcategoria", () => {
  it("is false when no matching subcategories exist", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax", category: "irrf" }));
    expect(rules.exibirSubcategoria).toBe(false);
  });

  it("is true for expense company servicos", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company", category: "servicos",
    }));
    expect(rules.exibirSubcategoria).toBe(true);
  });

  it("is true for expense artist caches", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist", category: "caches",
    }));
    expect(rules.exibirSubcategoria).toBe(true);
  });

  it("is true for revenue company receitas-musicais", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company", category: "receitas-musicais",
    }));
    expect(rules.exibirSubcategoria).toBe(true);
  });

  it("is false for expense artist suporte-financeiro (no subcategories)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist", category: "suporte-financeiro",
    }));
    expect(rules.exibirSubcategoria).toBe(false);
  });
});

// ── exibirItemInvestimento ─────────────────────────────────────────────────
describe("exibirItemInvestimento", () => {
  it("is false when not investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", category: "equipamentos" }));
    expect(rules.exibirItemInvestimento).toBe(false);
  });

  it("is false for investment without category", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.exibirItemInvestimento).toBe(false);
  });

  it("is true for investment + equipamentos", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "equipamentos" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });

  it("is true for investment + tecnologia", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "tecnologia" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });

  it("is true for investment + marketing", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "marketing" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });

  it("is true for investment + formacao", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "formacao" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });

  it("is true for investment + infraestrutura", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment", category: "infraestrutura" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });
});

// ── exibirArtista ──────────────────────────────────────────────────────────
describe("exibirArtista", () => {
  it("is false for plain tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.exibirArtista).toBe(false);
  });

  it("is true for expense company servicos + design-grafico (expenseServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "design-grafico",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is false for expense company servicos + assessoria-juridica (not in expenseServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "assessoria-juridica",
    }));
    expect(rules.exibirArtista).toBe(false);
  });

  it("is true for expense company marketing + any subcategory", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is false for expense company marketing without subcategory", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "",
    }));
    expect(rules.exibirArtista).toBe(false);
  });

  it("is true for expense company viagens + passagens", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "viagens", subcategory: "passagens",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for expense company produtos + equipamentos", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "produtos", subcategory: "equipamentos",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for expense company suporte-financeiro (no subcategory needed)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "suporte-financeiro",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for expense artist caches + show-evento", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "caches", subcategory: "show-evento",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for expense artist suporte-financeiro (no subcategory needed)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "suporte-financeiro",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for revenue company receitas-musicais + external-rights-streaming", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "external-rights-streaming",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for revenue company servicos + producao-musical (revenueServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "producao-musical",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for revenue company servicos + criacao-site (revenueServicesRequiringArtistOnly)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "criacao-site",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is false for revenue company servicos + consultoria (not in either list)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "consultoria",
    }));
    expect(rules.exibirArtista).toBe(false);
  });

  it("is true for revenue company produtos + venda-merchandising", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "produtos", subcategory: "venda-merchandising",
    }));
    expect(rules.exibirArtista).toBe(true);
  });
});

// ── exibirProjeto ──────────────────────────────────────────────────────────
describe("exibirProjeto", () => {
  it("is true for expense company servicos + design-grafico", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "design-grafico",
    }));
    expect(rules.exibirProjeto).toBe(true);
  });

  it("is false for expense company servicos + assessoria-juridica", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "assessoria-juridica",
    }));
    expect(rules.exibirProjeto).toBe(false);
  });

  it("is true for expense company marketing + subcategory + artistId", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios", artistId: "artista-1",
    }));
    expect(rules.exibirProjeto).toBe(true);
  });

  it("is false for expense company marketing without artistId", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios",
    }));
    expect(rules.exibirProjeto).toBe(false);
  });

  it("is true for revenue company receitas-musicais + direitos-autorais", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "direitos-autorais",
    }));
    expect(rules.exibirProjeto).toBe(true);
  });

  it("is false for revenue company receitas-musicais + participacao-show-evento (not in musicRevenueRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "participacao-show-evento",
    }));
    expect(rules.exibirProjeto).toBe(false);
  });

  it("is true for revenue company servicos + producao-musical", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "producao-musical",
    }));
    expect(rules.exibirProjeto).toBe(true);
  });

  it("is false for revenue company servicos + criacao-site (artist only, no project)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "criacao-site",
    }));
    expect(rules.exibirProjeto).toBe(false);
  });
});

// ── projetoObrigatorio ─────────────────────────────────────────────────────
describe("projetoObrigatorio", () => {
  it("is true for expense company servicos + design-grafico", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "servicos", subcategory: "design-grafico",
    }));
    expect(rules.projetoObrigatorio).toBe(true);
  });

  it("is false for expense company marketing (artist optional, project conditional)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios",
    }));
    expect(rules.projetoObrigatorio).toBe(false);
  });

  it("is true for revenue company receitas-musicais + external-rights-streaming", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "external-rights-streaming",
    }));
    expect(rules.projetoObrigatorio).toBe(true);
  });

  it("is false for revenue company receitas-musicais + participacao-show-evento", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "participacao-show-evento",
    }));
    expect(rules.projetoObrigatorio).toBe(false);
  });

  it("is true for revenue company servicos + producao-musical", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "producao-musical",
    }));
    expect(rules.projetoObrigatorio).toBe(true);
  });

  it("is false for revenue company servicos + criacao-site", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "servicos", subcategory: "criacao-site",
    }));
    expect(rules.projetoObrigatorio).toBe(false);
  });
});

// ── exibirEvento ───────────────────────────────────────────────────────────
describe("exibirEvento", () => {
  it("is false when nothing relevant is selected", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense" }));
    expect(rules.exibirEvento).toBe(false);
  });

  it("is true for expense company produtos + cenografia-pirotecnia", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "produtos", subcategory: "cenografia-pirotecnia",
    }));
    expect(rules.exibirEvento).toBe(true);
  });

  it("is false for expense company produtos + equipamentos (not in expenseProductsRequiringEvent)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "produtos", subcategory: "equipamentos",
    }));
    expect(rules.exibirEvento).toBe(false);
  });

  it("is true for expense artist caches + show-evento", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "caches", subcategory: "show-evento",
    }));
    expect(rules.exibirEvento).toBe(true);
  });

  it("is false for expense artist caches + publicidade", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "caches", subcategory: "publicidade",
    }));
    expect(rules.exibirEvento).toBe(false);
  });

  it("is true for revenue company receitas-musicais + participacao-show-evento", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "participacao-show-evento",
    }));
    expect(rules.exibirEvento).toBe(true);
  });

  it("is true for revenue company receitas-musicais + venda-show-fechado", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "venda-show-fechado",
    }));
    expect(rules.exibirEvento).toBe(true);
  });

  it("is false for revenue company receitas-musicais + direitos-autorais", () => {
    const rules = computeFinancialRules(form({
      transactionType: "revenue", counterpartyType: "company",
      category: "receitas-musicais", subcategory: "direitos-autorais",
    }));
    expect(rules.exibirEvento).toBe(false);
  });
});

// ── exibirFornecedor ───────────────────────────────────────────────────────
describe("exibirFornecedor", () => {
  it("is false for tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.exibirFornecedor).toBe(false);
  });

  it("is false for investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.exibirFornecedor).toBe(false);
  });

  it("is true for expense company", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company" }));
    expect(rules.exibirFornecedor).toBe(true);
  });

  it("is true for expense individual", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "individual" }));
    expect(rules.exibirFornecedor).toBe(true);
  });

  it("is false for expense artist", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "artist" }));
    expect(rules.exibirFornecedor).toBe(false);
  });

  it("is true for revenue company", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue", counterpartyType: "company" }));
    expect(rules.exibirFornecedor).toBe(true);
  });

  it("is false for revenue artist", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue", counterpartyType: "artist" }));
    expect(rules.exibirFornecedor).toBe(false);
  });
});

// ── exibirOrgaoArrecadador ─────────────────────────────────────────────────
describe("exibirOrgaoArrecadador", () => {
  it("is true for tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.exibirOrgaoArrecadador).toBe(true);
  });

  it("is false for any other type", () => {
    for (const t of ["expense", "revenue", "investment", "transfer"]) {
      const rules = computeFinancialRules(form({ transactionType: t }));
      expect(rules.exibirOrgaoArrecadador).toBe(false);
    }
  });
});

// ── exibirMotivoViagem ─────────────────────────────────────────────────────
describe("exibirMotivoViagem", () => {
  it("is false when not expense viagem", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company", category: "servicos", subcategory: "design-grafico" }));
    expect(rules.exibirMotivoViagem).toBe(false);
  });

  it("is false for expense company viagens without subcategory", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "company", category: "viagens" }));
    expect(rules.exibirMotivoViagem).toBe(false);
  });

  it("is true for expense company viagens + passagens", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "viagens", subcategory: "passagens",
    }));
    expect(rules.exibirMotivoViagem).toBe(true);
  });

  it("is true for expense individual viagens + hospedagem", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "individual",
      category: "viagens", subcategory: "hospedagem",
    }));
    expect(rules.exibirMotivoViagem).toBe(true);
  });
});

// ── exibirAdvertisingName ──────────────────────────────────────────────────
describe("exibirAdvertisingName", () => {
  it("is false for non-artist caches publicidade scenarios", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense", counterpartyType: "artist", category: "caches", subcategory: "show-evento" }));
    expect(rules.exibirAdvertisingName).toBe(false);
  });

  it("is true for expense artist caches + publicidade", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "artist",
      category: "caches", subcategory: "publicidade",
    }));
    expect(rules.exibirAdvertisingName).toBe(true);
  });

  it("is false for expense company marketing (not artist caches)", () => {
    const rules = computeFinancialRules(form({
      transactionType: "expense", counterpartyType: "company",
      category: "marketing", subcategory: "anuncios",
    }));
    expect(rules.exibirAdvertisingName).toBe(false);
  });
});

// ── exibirParcelamento ─────────────────────────────────────────────────────
describe("exibirParcelamento", () => {
  it("is false when paymentType is upfront", () => {
    const rules = computeFinancialRules(form({ paymentType: "upfront" }));
    expect(rules.exibirParcelamento).toBe(false);
  });

  it("is true when paymentType is installments", () => {
    const rules = computeFinancialRules(form({ paymentType: "installments" }));
    expect(rules.exibirParcelamento).toBe(true);
  });
});

// ── labelTipoCliente ───────────────────────────────────────────────────────
describe("labelTipoCliente", () => {
  it("returns 'Pagar quem' for expense", () => {
    const rules = computeFinancialRules(form({ transactionType: "expense" }));
    expect(rules.labelTipoCliente).toBe("Pagar quem");
  });

  it("returns 'Receber de' for revenue", () => {
    const rules = computeFinancialRules(form({ transactionType: "revenue" }));
    expect(rules.labelTipoCliente).toBe("Receber de");
  });

  it("returns 'Tipo de Cliente' for tax", () => {
    const rules = computeFinancialRules(form({ transactionType: "tax" }));
    expect(rules.labelTipoCliente).toBe("Tipo de Cliente");
  });

  it("returns 'Tipo de Cliente' for investment", () => {
    const rules = computeFinancialRules(form({ transactionType: "investment" }));
    expect(rules.labelTipoCliente).toBe("Tipo de Cliente");
  });

  it("returns 'Tipo de Cliente' for empty transactionType", () => {
    const rules = computeFinancialRules(form({}));
    expect(rules.labelTipoCliente).toBe("Tipo de Cliente");
  });
});

