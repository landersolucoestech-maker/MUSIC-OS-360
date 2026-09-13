import { describe, it, expect } from "vitest";
import { validateTransactionForm } from "../financial-form-validation";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import type { FinancialFormRules } from "@/modules/accounting/components/transaction-form/rules/financial-form-rules";

const baseForm: TransactionFormData = {
  entityLinks: [],
  tipoTransacao: "despesa",
  tipoCliente: "empresa",
  categoria: "servicos",
  subcategoria: "design-grafico",
  descricao: "Pagamento de design",
  valor: "1500",
  dataTransacao: "2026-05-01",
  status: "pending",
  observacao: "",
  artistaVinculado: "artista-1",
  projetoVinculado: "proj-1",
  contratoVinculado: "",
  eventoVinculado: "evento-1",
  fornecedorCliente: "Fornecedor XYZ",
  orgaoArrecadador: "",
  itemInvestimento: "",
  motivoViagem: "",
  nomePublicidade: "",
  formaPagamento: "pix",
  tipoPagamento: "avista",
  quantidadeParcelas: "",
  intervaloParcelas: "mensal",
  dataPrimeiraParcela: "",
  anexoUrl: "",
  anexoNome: "",
};

const noRules: FinancialFormRules = {
  exibirTipoCliente: false,
  exibirCategoria: false,
  exibirSubcategoria: false,
  exibirItemInvestimento: false,
  exibirArtista: false,
  exibirProjeto: false,
  projetoObrigatorio: false,
  exibirEvento: false,
  exibirFornecedor: false,
  exibirOrgaoArrecadador: false,
  exibirMotivoViagem: false,
  exibirNomePublicidade: false,
  exibirParcelamento: false,
  labelTipoCliente: "Tipo de Cliente",
};

const allRules: FinancialFormRules = {
  exibirTipoCliente: true,
  exibirCategoria: true,
  exibirSubcategoria: true,
  exibirItemInvestimento: false,
  exibirArtista: true,
  exibirProjeto: true,
  projetoObrigatorio: true,
  exibirEvento: true,
  exibirFornecedor: true,
  exibirOrgaoArrecadador: false,
  exibirMotivoViagem: false,
  exibirNomePublicidade: false,
  exibirParcelamento: false,
  labelTipoCliente: "Para quem pagar",
};

function form(overrides: Partial<TransactionFormData>): TransactionFormData {
  return { ...baseForm, ...overrides };
}

function rules(overrides: Partial<FinancialFormRules>): FinancialFormRules {
  return { ...noRules, ...overrides };
}

// ── Always-required fields ─────────────────────────────────────────────────
describe("always-required fields", () => {
  it("returns no errors for a complete valid form", () => {
    const errors = validateTransactionForm(baseForm, allRules);
    expect(errors).toEqual({});
  });

  it("errors when tipoTransacao is empty", () => {
    const errors = validateTransactionForm(form({ tipoTransacao: "" }), noRules);
    expect(errors.tipoTransacao).toBe("Selecione o tipo de transação");
  });

  it("errors when descricao is empty", () => {
    const errors = validateTransactionForm(form({ descricao: "" }), noRules);
    expect(errors.descricao).toBe("Informe a descrição");
  });

  it("errors when descricao is only whitespace", () => {
    const errors = validateTransactionForm(form({ descricao: "   " }), noRules);
    expect(errors.descricao).toBe("Informe a descrição");
  });

  it("errors when valor is empty", () => {
    const errors = validateTransactionForm(form({ valor: "" }), noRules);
    expect(errors.valor).toBe("Informe um valor válido");
  });

  it("errors when valor is zero", () => {
    const errors = validateTransactionForm(form({ valor: "0" }), noRules);
    expect(errors.valor).toBe("Informe um valor válido");
  });

  it("errors when valor is negative", () => {
    const errors = validateTransactionForm(form({ valor: "-10" }), noRules);
    expect(errors.valor).toBe("Informe um valor válido");
  });

  it("no valor error when valor is positive", () => {
    const errors = validateTransactionForm(form({ valor: "0.01" }), noRules);
    expect(errors.valor).toBeUndefined();
  });

  it("errors when dataTransacao is empty", () => {
    const errors = validateTransactionForm(form({ dataTransacao: "" }), noRules);
    expect(errors.dataTransacao).toBe("Informe a data da transação");
  });

  it("errors when formaPagamento is empty", () => {
    const errors = validateTransactionForm(form({ formaPagamento: "" }), noRules);
    expect(errors.formaPagamento).toBe("Selecione a forma de pagamento");
  });
});

// ── exibirTipoCliente ──────────────────────────────────────────────────────
describe("tipoCliente validation", () => {
  it("errors when exibirTipoCliente is true and tipoCliente is empty", () => {
    const errors = validateTransactionForm(
      form({ tipoCliente: "" }),
      rules({ exibirTipoCliente: true }),
    );
    expect(errors.tipoCliente).toBe("Selecione o tipo de cliente");
  });

  it("no error when exibirTipoCliente is false, even if tipoCliente is empty", () => {
    const errors = validateTransactionForm(
      form({ tipoCliente: "" }),
      rules({ exibirTipoCliente: false }),
    );
    expect(errors.tipoCliente).toBeUndefined();
  });

  it("no error when exibirTipoCliente is true and tipoCliente is provided", () => {
    const errors = validateTransactionForm(
      form({ tipoCliente: "empresa" }),
      rules({ exibirTipoCliente: true }),
    );
    expect(errors.tipoCliente).toBeUndefined();
  });
});

// ── exibirCategoria ────────────────────────────────────────────────────────
describe("categoria validation", () => {
  it("errors when exibirCategoria is true and categoria is empty", () => {
    const errors = validateTransactionForm(
      form({ categoria: "" }),
      rules({ exibirCategoria: true }),
    );
    expect(errors.categoria).toBe("Selecione a categoria");
  });

  it("no error when exibirCategoria is false and categoria is empty", () => {
    const errors = validateTransactionForm(
      form({ categoria: "" }),
      rules({ exibirCategoria: false }),
    );
    expect(errors.categoria).toBeUndefined();
  });
});

// ── exibirSubcategoria ─────────────────────────────────────────────────────
describe("subcategoria validation", () => {
  it("errors when exibirSubcategoria is true and subcategoria is empty", () => {
    const errors = validateTransactionForm(
      form({ subcategoria: "" }),
      rules({ exibirSubcategoria: true }),
    );
    expect(errors.subcategoria).toBe("Selecione a subcategoria");
  });

  it("no error when exibirSubcategoria is false and subcategoria is empty", () => {
    const errors = validateTransactionForm(
      form({ subcategoria: "" }),
      rules({ exibirSubcategoria: false }),
    );
    expect(errors.subcategoria).toBeUndefined();
  });
});

// ── exibirArtista ──────────────────────────────────────────────────────────
describe("artistaVinculado validation", () => {
  it("errors when exibirArtista is true and artistaVinculado is empty", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "" }),
      rules({ exibirArtista: true }),
    );
    expect(errors.artistaVinculado).toBe("Selecione o artista");
  });

  it("no error when exibirArtista is false and artistaVinculado is empty", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "" }),
      rules({ exibirArtista: false }),
    );
    expect(errors.artistaVinculado).toBeUndefined();
  });

  it("no error when exibirArtista is true and artistaVinculado is provided", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "artista-1" }),
      rules({ exibirArtista: true }),
    );
    expect(errors.artistaVinculado).toBeUndefined();
  });
});

// ── exibirProjeto + projetoObrigatorio ─────────────────────────────────────
describe("projetoVinculado validation", () => {
  it("errors when projeto is visible, obrigatorio, artista is linked but projeto is empty", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "artista-1", projetoVinculado: "" }),
      rules({ exibirProjeto: true, projetoObrigatorio: true }),
    );
    expect(errors.projetoVinculado).toBe("Selecione o projeto");
  });

  it("no error when projetoObrigatorio is false even if projeto is empty", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "artista-1", projetoVinculado: "" }),
      rules({ exibirProjeto: true, projetoObrigatorio: false }),
    );
    expect(errors.projetoVinculado).toBeUndefined();
  });

  it("no error when projeto is visible+obrigatorio but artistaVinculado is empty", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "", projetoVinculado: "" }),
      rules({ exibirProjeto: true, projetoObrigatorio: true }),
    );
    expect(errors.projetoVinculado).toBeUndefined();
  });

  it("no error when exibirProjeto is false even if all conditions are met", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "artista-1", projetoVinculado: "" }),
      rules({ exibirProjeto: false, projetoObrigatorio: true }),
    );
    expect(errors.projetoVinculado).toBeUndefined();
  });

  it("no error when projetoVinculado is provided", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "artista-1", projetoVinculado: "proj-1" }),
      rules({ exibirProjeto: true, projetoObrigatorio: true }),
    );
    expect(errors.projetoVinculado).toBeUndefined();
  });
});

// ── exibirEvento ───────────────────────────────────────────────────────────
describe("eventoVinculado validation", () => {
  it("errors when exibirEvento is true, artista is linked but evento is empty", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "artista-1", eventoVinculado: "" }),
      rules({ exibirEvento: true }),
    );
    expect(errors.eventoVinculado).toBe("Selecione o show/evento");
  });

  it("no error when exibirEvento is true but artistaVinculado is empty", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "", eventoVinculado: "" }),
      rules({ exibirEvento: true }),
    );
    expect(errors.eventoVinculado).toBeUndefined();
  });

  it("no error when exibirEvento is false even if artista is linked", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "artista-1", eventoVinculado: "" }),
      rules({ exibirEvento: false }),
    );
    expect(errors.eventoVinculado).toBeUndefined();
  });

  it("no error when eventoVinculado is provided", () => {
    const errors = validateTransactionForm(
      form({ artistaVinculado: "artista-1", eventoVinculado: "evento-1" }),
      rules({ exibirEvento: true }),
    );
    expect(errors.eventoVinculado).toBeUndefined();
  });
});

// ── exibirMotivoViagem ─────────────────────────────────────────────────────
describe("motivoViagem validation", () => {
  it("errors when exibirMotivoViagem is true and motivoViagem is empty", () => {
    const errors = validateTransactionForm(
      form({ motivoViagem: "" }),
      rules({ exibirMotivoViagem: true }),
    );
    expect(errors.motivoViagem).toBe("Informe o motivo da viagem");
  });

  it("errors when exibirMotivoViagem is true and motivoViagem is whitespace", () => {
    const errors = validateTransactionForm(
      form({ motivoViagem: "  " }),
      rules({ exibirMotivoViagem: true }),
    );
    expect(errors.motivoViagem).toBe("Informe o motivo da viagem");
  });

  it("no error when exibirMotivoViagem is false", () => {
    const errors = validateTransactionForm(
      form({ motivoViagem: "" }),
      rules({ exibirMotivoViagem: false }),
    );
    expect(errors.motivoViagem).toBeUndefined();
  });

  it("no error when motivoViagem is provided", () => {
    const errors = validateTransactionForm(
      form({ motivoViagem: "Turnê nacional" }),
      rules({ exibirMotivoViagem: true }),
    );
    expect(errors.motivoViagem).toBeUndefined();
  });
});

// ── exibirNomePublicidade ──────────────────────────────────────────────────
describe("nomePublicidade validation", () => {
  it("errors when exibirNomePublicidade is true and nomePublicidade is empty", () => {
    const errors = validateTransactionForm(
      form({ nomePublicidade: "" }),
      rules({ exibirNomePublicidade: true }),
    );
    expect(errors.nomePublicidade).toBe("Informe o nome da publicidade");
  });

  it("errors when nomePublicidade is whitespace", () => {
    const errors = validateTransactionForm(
      form({ nomePublicidade: "  " }),
      rules({ exibirNomePublicidade: true }),
    );
    expect(errors.nomePublicidade).toBe("Informe o nome da publicidade");
  });

  it("no error when exibirNomePublicidade is false", () => {
    const errors = validateTransactionForm(
      form({ nomePublicidade: "" }),
      rules({ exibirNomePublicidade: false }),
    );
    expect(errors.nomePublicidade).toBeUndefined();
  });

  it("no error when nomePublicidade is provided", () => {
    const errors = validateTransactionForm(
      form({ nomePublicidade: "Campanha Verão" }),
      rules({ exibirNomePublicidade: true }),
    );
    expect(errors.nomePublicidade).toBeUndefined();
  });
});

// ── exibirOrgaoArrecadador ─────────────────────────────────────────────────
describe("orgaoArrecadador validation", () => {
  it("errors when exibirOrgaoArrecadador is true and orgaoArrecadador is empty", () => {
    const errors = validateTransactionForm(
      form({ orgaoArrecadador: "" }),
      rules({ exibirOrgaoArrecadador: true }),
    );
    expect(errors.orgaoArrecadador).toBe("Selecione o órgão arrecadador");
  });

  it("no error when exibirOrgaoArrecadador is false", () => {
    const errors = validateTransactionForm(
      form({ orgaoArrecadador: "" }),
      rules({ exibirOrgaoArrecadador: false }),
    );
    expect(errors.orgaoArrecadador).toBeUndefined();
  });

  it("no error when orgaoArrecadador is provided", () => {
    const errors = validateTransactionForm(
      form({ orgaoArrecadador: "Receita Federal" }),
      rules({ exibirOrgaoArrecadador: true }),
    );
    expect(errors.orgaoArrecadador).toBeUndefined();
  });
});

// ── exibirParcelamento ─────────────────────────────────────────────────────
describe("parcelamento validation", () => {
  it("errors on quantidadeParcelas < 2 when parcelamento is visible", () => {
    const errors = validateTransactionForm(
      form({ quantidadeParcelas: "1", dataPrimeiraParcela: "2026-06-01" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.quantidadeParcelas).toBe("Mínimo 2 parcelas");
  });

  it("errors on empty quantidadeParcelas when parcelamento is visible", () => {
    const errors = validateTransactionForm(
      form({ quantidadeParcelas: "", dataPrimeiraParcela: "2026-06-01" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.quantidadeParcelas).toBe("Mínimo 2 parcelas");
  });

  it("no error on quantidadeParcelas = 2 with date", () => {
    const errors = validateTransactionForm(
      form({ quantidadeParcelas: "2", dataPrimeiraParcela: "2026-06-01" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.quantidadeParcelas).toBeUndefined();
  });

  it("errors on missing dataPrimeiraParcela when parcelamento is visible", () => {
    const errors = validateTransactionForm(
      form({ quantidadeParcelas: "3", dataPrimeiraParcela: "" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.dataPrimeiraParcela).toBe("Informe a data da primeira parcela");
  });

  it("no error on dataPrimeiraParcela when provided", () => {
    const errors = validateTransactionForm(
      form({ quantidadeParcelas: "3", dataPrimeiraParcela: "2026-06-01" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.dataPrimeiraParcela).toBeUndefined();
  });

  it("no parcelamento errors when exibirParcelamento is false", () => {
    const errors = validateTransactionForm(
      form({ quantidadeParcelas: "", dataPrimeiraParcela: "" }),
      rules({ exibirParcelamento: false }),
    );
    expect(errors.quantidadeParcelas).toBeUndefined();
    expect(errors.dataPrimeiraParcela).toBeUndefined();
  });
});

// ── multiple errors at once ────────────────────────────────────────────────
describe("multiple simultaneous errors", () => {
  it("collects all missing required fields at once", () => {
    const emptyForm: TransactionFormData = {
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
    const errors = validateTransactionForm(emptyForm, noRules);
    expect(errors.tipoTransacao).toBeDefined();
    expect(errors.descricao).toBeDefined();
    expect(errors.valor).toBeDefined();
    expect(errors.dataTransacao).toBeDefined();
    expect(errors.formaPagamento).toBeDefined();
  });
});

