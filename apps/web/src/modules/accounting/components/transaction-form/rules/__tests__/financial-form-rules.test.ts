import { describe, it, expect } from "vitest";
import { computeFinancialRules } from "../financial-form-rules";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

const base: TransactionFormData = {
  entityLinks: [],
  tipoTransacao: "",
  tipoCliente: "",
  categoria: "",
  subcategoria: "",
  descricao: "",
  valor: "",
  dataTransacao: "",
  status: "pending",
  observacao: "",
  artistaVinculado: "",
  projetoVinculado: "",
  contratoVinculado: "",
  eventoVinculado: "",
  fornecedorCliente: "",
  orgaoArrecadador: "",
  itemInvestimento: "",
  motivoViagem: "",
  nomePublicidade: "",
  formaPagamento: "",
  tipoPagamento: "avista",
  quantidadeParcelas: "",
  intervaloParcelas: "mensal",
  dataPrimeiraParcela: "",
  anexoUrl: "",
  anexoNome: "",
};

function form(overrides: Partial<TransactionFormData>): TransactionFormData {
  return { ...base, ...overrides };
}

// ── exibirTipoCliente ──────────────────────────────────────────────────────
describe("exibirTipoCliente", () => {
  it("is false when tipoTransacao is empty", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "" }));
    expect(rules.exibirTipoCliente).toBe(false);
  });

  it("is true for despesa", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa" }));
    expect(rules.exibirTipoCliente).toBe(true);
  });

  it("is true for receita", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "receita" }));
    expect(rules.exibirTipoCliente).toBe(true);
  });

  it("is false for imposto", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "imposto" }));
    expect(rules.exibirTipoCliente).toBe(false);
  });

  it("is false for transferencia", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "transferencia" }));
    expect(rules.exibirTipoCliente).toBe(false);
  });

  it("is false for investimento", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento" }));
    expect(rules.exibirTipoCliente).toBe(false);
  });
});

// ── exibirCategoria ────────────────────────────────────────────────────────
describe("exibirCategoria", () => {
  it("is false when tipoTransacao is empty", () => {
    const rules = computeFinancialRules(form({}));
    expect(rules.exibirCategoria).toBe(false);
  });

  it("is true for imposto (no tipoCliente needed)", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "imposto" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is true for transferencia (no tipoCliente needed)", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "transferencia" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is true for investimento (no tipoCliente needed)", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is true for despesa + empresa", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa", tipoCliente: "empresa" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is true for receita + empresa", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "receita", tipoCliente: "empresa" }));
    expect(rules.exibirCategoria).toBe(true);
  });

  it("is false for despesa without tipoCliente", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa" }));
    expect(rules.exibirCategoria).toBe(false);
  });
});

// ── exibirSubcategoria ─────────────────────────────────────────────────────
describe("exibirSubcategoria", () => {
  it("is false when no matching subcategories exist", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "imposto", categoria: "irrf" }));
    expect(rules.exibirSubcategoria).toBe(false);
  });

  it("is true for despesa empresa servicos", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa", categoria: "servicos",
    }));
    expect(rules.exibirSubcategoria).toBe(true);
  });

  it("is true for despesa artista caches", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "artista", categoria: "caches",
    }));
    expect(rules.exibirSubcategoria).toBe(true);
  });

  it("is true for receita empresa receitas-musicais", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa", categoria: "receitas-musicais",
    }));
    expect(rules.exibirSubcategoria).toBe(true);
  });

  it("is false for despesa artista suporte-financeiro (no subcategories)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "artista", categoria: "suporte-financeiro",
    }));
    expect(rules.exibirSubcategoria).toBe(false);
  });
});

// ── exibirItemInvestimento ─────────────────────────────────────────────────
describe("exibirItemInvestimento", () => {
  it("is false when not investimento", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa", categoria: "equipamentos" }));
    expect(rules.exibirItemInvestimento).toBe(false);
  });

  it("is false for investimento without categoria", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento" }));
    expect(rules.exibirItemInvestimento).toBe(false);
  });

  it("is true for investimento + equipamentos", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento", categoria: "equipamentos" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });

  it("is true for investimento + tecnologia", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento", categoria: "tecnologia" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });

  it("is true for investimento + marketing", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento", categoria: "marketing" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });

  it("is true for investimento + formacao", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento", categoria: "formacao" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });

  it("is true for investimento + infraestrutura", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento", categoria: "infraestrutura" }));
    expect(rules.exibirItemInvestimento).toBe(true);
  });
});

// ── exibirArtista ──────────────────────────────────────────────────────────
describe("exibirArtista", () => {
  it("is false for plain imposto", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "imposto" }));
    expect(rules.exibirArtista).toBe(false);
  });

  it("is true for despesa empresa servicos + design-grafico (expenseServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "design-grafico",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is false for despesa empresa servicos + assessoria-juridica (not in expenseServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "assessoria-juridica",
    }));
    expect(rules.exibirArtista).toBe(false);
  });

  it("is true for despesa empresa marketing + any subcategoria", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "marketing", subcategoria: "anuncios",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is false for despesa empresa marketing without subcategoria", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "marketing", subcategoria: "",
    }));
    expect(rules.exibirArtista).toBe(false);
  });

  it("is true for despesa empresa viagens + passagens", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "viagens", subcategoria: "passagens",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for despesa empresa produtos + equipamentos", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "produtos", subcategoria: "equipamentos",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for despesa empresa suporte-financeiro (no subcategoria needed)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "suporte-financeiro",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for despesa artista caches + show-evento", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "artista",
      categoria: "caches", subcategoria: "show-evento",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for despesa artista suporte-financeiro (no subcategoria needed)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "artista",
      categoria: "suporte-financeiro",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for receita empresa receitas-musicais + external-rights-streaming", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "receitas-musicais", subcategoria: "external-rights-streaming",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for receita empresa servicos + producao-musical (revenueServicesRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "producao-musical",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is true for receita empresa servicos + criacao-site (revenueServicesRequiringArtistOnly)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "criacao-site",
    }));
    expect(rules.exibirArtista).toBe(true);
  });

  it("is false for receita empresa servicos + consultoria (not in either list)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "consultoria",
    }));
    expect(rules.exibirArtista).toBe(false);
  });

  it("is true for receita empresa produtos + venda-merchandising", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "produtos", subcategoria: "venda-merchandising",
    }));
    expect(rules.exibirArtista).toBe(true);
  });
});

// ── exibirProjeto ──────────────────────────────────────────────────────────
describe("exibirProjeto", () => {
  it("is true for despesa empresa servicos + design-grafico", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "design-grafico",
    }));
    expect(rules.exibirProjeto).toBe(true);
  });

  it("is false for despesa empresa servicos + assessoria-juridica", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "assessoria-juridica",
    }));
    expect(rules.exibirProjeto).toBe(false);
  });

  it("is true for despesa empresa marketing + subcategoria + artistaVinculado", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "marketing", subcategoria: "anuncios", artistaVinculado: "artista-1",
    }));
    expect(rules.exibirProjeto).toBe(true);
  });

  it("is false for despesa empresa marketing without artistaVinculado", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "marketing", subcategoria: "anuncios",
    }));
    expect(rules.exibirProjeto).toBe(false);
  });

  it("is true for receita empresa receitas-musicais + direitos-autorais", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "receitas-musicais", subcategoria: "direitos-autorais",
    }));
    expect(rules.exibirProjeto).toBe(true);
  });

  it("is false for receita empresa receitas-musicais + participacao-show-evento (not in musicRevenueRequiringArtistAndProject)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "receitas-musicais", subcategoria: "participacao-show-evento",
    }));
    expect(rules.exibirProjeto).toBe(false);
  });

  it("is true for receita empresa servicos + producao-musical", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "producao-musical",
    }));
    expect(rules.exibirProjeto).toBe(true);
  });

  it("is false for receita empresa servicos + criacao-site (artista only, no project)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "criacao-site",
    }));
    expect(rules.exibirProjeto).toBe(false);
  });
});

// ── projetoObrigatorio ─────────────────────────────────────────────────────
describe("projetoObrigatorio", () => {
  it("is true for despesa empresa servicos + design-grafico", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "design-grafico",
    }));
    expect(rules.projetoObrigatorio).toBe(true);
  });

  it("is false for despesa empresa marketing (artista optional, project conditional)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "marketing", subcategoria: "anuncios",
    }));
    expect(rules.projetoObrigatorio).toBe(false);
  });

  it("is true for receita empresa receitas-musicais + external-rights-streaming", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "receitas-musicais", subcategoria: "external-rights-streaming",
    }));
    expect(rules.projetoObrigatorio).toBe(true);
  });

  it("is false for receita empresa receitas-musicais + participacao-show-evento", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "receitas-musicais", subcategoria: "participacao-show-evento",
    }));
    expect(rules.projetoObrigatorio).toBe(false);
  });

  it("is true for receita empresa servicos + producao-musical", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "producao-musical",
    }));
    expect(rules.projetoObrigatorio).toBe(true);
  });

  it("is false for receita empresa servicos + criacao-site", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "servicos", subcategoria: "criacao-site",
    }));
    expect(rules.projetoObrigatorio).toBe(false);
  });
});

// ── exibirEvento ───────────────────────────────────────────────────────────
describe("exibirEvento", () => {
  it("is false when nothing relevant is selected", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa" }));
    expect(rules.exibirEvento).toBe(false);
  });

  it("is true for despesa empresa produtos + cenografia-pirotecnia", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "produtos", subcategoria: "cenografia-pirotecnia",
    }));
    expect(rules.exibirEvento).toBe(true);
  });

  it("is false for despesa empresa produtos + equipamentos (not in expenseProductsRequiringEvent)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "produtos", subcategoria: "equipamentos",
    }));
    expect(rules.exibirEvento).toBe(false);
  });

  it("is true for despesa artista caches + show-evento", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "artista",
      categoria: "caches", subcategoria: "show-evento",
    }));
    expect(rules.exibirEvento).toBe(true);
  });

  it("is false for despesa artista caches + publicidade", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "artista",
      categoria: "caches", subcategoria: "publicidade",
    }));
    expect(rules.exibirEvento).toBe(false);
  });

  it("is true for receita empresa receitas-musicais + participacao-show-evento", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "receitas-musicais", subcategoria: "participacao-show-evento",
    }));
    expect(rules.exibirEvento).toBe(true);
  });

  it("is true for receita empresa receitas-musicais + venda-show-fechado", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "receitas-musicais", subcategoria: "venda-show-fechado",
    }));
    expect(rules.exibirEvento).toBe(true);
  });

  it("is false for receita empresa receitas-musicais + direitos-autorais", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "receita", tipoCliente: "empresa",
      categoria: "receitas-musicais", subcategoria: "direitos-autorais",
    }));
    expect(rules.exibirEvento).toBe(false);
  });
});

// ── exibirFornecedor ───────────────────────────────────────────────────────
describe("exibirFornecedor", () => {
  it("is false for imposto", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "imposto" }));
    expect(rules.exibirFornecedor).toBe(false);
  });

  it("is false for investimento", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento" }));
    expect(rules.exibirFornecedor).toBe(false);
  });

  it("is true for despesa empresa", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa", tipoCliente: "empresa" }));
    expect(rules.exibirFornecedor).toBe(true);
  });

  it("is true for despesa pessoa", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa", tipoCliente: "pessoa" }));
    expect(rules.exibirFornecedor).toBe(true);
  });

  it("is false for despesa artista", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa", tipoCliente: "artista" }));
    expect(rules.exibirFornecedor).toBe(false);
  });

  it("is true for receita empresa", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "receita", tipoCliente: "empresa" }));
    expect(rules.exibirFornecedor).toBe(true);
  });

  it("is false for receita artista", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "receita", tipoCliente: "artista" }));
    expect(rules.exibirFornecedor).toBe(false);
  });
});

// ── exibirOrgaoArrecadador ─────────────────────────────────────────────────
describe("exibirOrgaoArrecadador", () => {
  it("is true for imposto", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "imposto" }));
    expect(rules.exibirOrgaoArrecadador).toBe(true);
  });

  it("is false for any other type", () => {
    for (const t of ["despesa", "receita", "investimento", "transferencia"]) {
      const rules = computeFinancialRules(form({ tipoTransacao: t }));
      expect(rules.exibirOrgaoArrecadador).toBe(false);
    }
  });
});

// ── exibirMotivoViagem ─────────────────────────────────────────────────────
describe("exibirMotivoViagem", () => {
  it("is false when not despesa viagem", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa", tipoCliente: "empresa", categoria: "servicos", subcategoria: "design-grafico" }));
    expect(rules.exibirMotivoViagem).toBe(false);
  });

  it("is false for despesa empresa viagens without subcategoria", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa", tipoCliente: "empresa", categoria: "viagens" }));
    expect(rules.exibirMotivoViagem).toBe(false);
  });

  it("is true for despesa empresa viagens + passagens", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "viagens", subcategoria: "passagens",
    }));
    expect(rules.exibirMotivoViagem).toBe(true);
  });

  it("is true for despesa pessoa viagens + hospedagem", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "pessoa",
      categoria: "viagens", subcategoria: "hospedagem",
    }));
    expect(rules.exibirMotivoViagem).toBe(true);
  });
});

// ── exibirNomePublicidade ──────────────────────────────────────────────────
describe("exibirNomePublicidade", () => {
  it("is false for non-artista caches publicidade scenarios", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa", tipoCliente: "artista", categoria: "caches", subcategoria: "show-evento" }));
    expect(rules.exibirNomePublicidade).toBe(false);
  });

  it("is true for despesa artista caches + publicidade", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "artista",
      categoria: "caches", subcategoria: "publicidade",
    }));
    expect(rules.exibirNomePublicidade).toBe(true);
  });

  it("is false for despesa empresa marketing (not artista caches)", () => {
    const rules = computeFinancialRules(form({
      tipoTransacao: "despesa", tipoCliente: "empresa",
      categoria: "marketing", subcategoria: "anuncios",
    }));
    expect(rules.exibirNomePublicidade).toBe(false);
  });
});

// ── exibirParcelamento ─────────────────────────────────────────────────────
describe("exibirParcelamento", () => {
  it("is false when tipoPagamento is avista", () => {
    const rules = computeFinancialRules(form({ tipoPagamento: "avista" }));
    expect(rules.exibirParcelamento).toBe(false);
  });

  it("is true when tipoPagamento is parcelado", () => {
    const rules = computeFinancialRules(form({ tipoPagamento: "parcelado" }));
    expect(rules.exibirParcelamento).toBe(true);
  });
});

// ── labelTipoCliente ───────────────────────────────────────────────────────
describe("labelTipoCliente", () => {
  it("returns 'Pagar quem' for despesa", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "despesa" }));
    expect(rules.labelTipoCliente).toBe("Pagar quem");
  });

  it("returns 'Receber de' for receita", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "receita" }));
    expect(rules.labelTipoCliente).toBe("Receber de");
  });

  it("returns 'Tipo de Cliente' for imposto", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "imposto" }));
    expect(rules.labelTipoCliente).toBe("Tipo de Cliente");
  });

  it("returns 'Tipo de Cliente' for investimento", () => {
    const rules = computeFinancialRules(form({ tipoTransacao: "investimento" }));
    expect(rules.labelTipoCliente).toBe("Tipo de Cliente");
  });

  it("returns 'Tipo de Cliente' for empty tipoTransacao", () => {
    const rules = computeFinancialRules(form({}));
    expect(rules.labelTipoCliente).toBe("Tipo de Cliente");
  });
});

