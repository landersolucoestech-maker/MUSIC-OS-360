import { describe, it, expect } from "vitest";
import { validateTransactionForm } from "../financial-form-validation";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import type { FinancialFormRules } from "@/modules/accounting/components/transaction-form/rules/financial-form-rules";

const baseForm: TransactionFormData = {
  entityLinks: [],
  transactionType: "expense",
  counterpartyType: "company",
  category: "servicos",
  subcategory: "design-grafico",
  description: "Pagamento de design",
  amount: "1500",
  transactionDate: "2026-05-01",
  status: "pending",
  notes: "",
  artistId: "artista-1",
  projectId: "proj-1",
  contractId: "",
  eventId: "evento-1",
  counterpartyName: "Fornecedor XYZ",
  taxAuthority: "",
  investmentItem: "",
  travelReason: "",
  advertisingName: "",
  paymentMethod: "pix",
  paymentType: "upfront",
  installmentCount: "",
  installmentInterval: "monthly",
  firstInstallmentDate: "",
  attachmentUrl: "",
  attachmentName: "",
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
  exibirAdvertisingName: false,
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
  exibirAdvertisingName: false,
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

  it("errors when transactionType is empty", () => {
    const errors = validateTransactionForm(form({ transactionType: "" }), noRules);
    expect(errors.transactionType).toBe("Selecione o tipo de transação");
  });

  it("errors when description is empty", () => {
    const errors = validateTransactionForm(form({ description: "" }), noRules);
    expect(errors.description).toBe("Informe a descrição");
  });

  it("errors when description is only whitespace", () => {
    const errors = validateTransactionForm(form({ description: "   " }), noRules);
    expect(errors.description).toBe("Informe a descrição");
  });

  it("errors when amount is empty", () => {
    const errors = validateTransactionForm(form({ amount: "" }), noRules);
    expect(errors.amount).toBe("Informe um valor válido");
  });

  it("errors when amount is zero", () => {
    const errors = validateTransactionForm(form({ amount: "0" }), noRules);
    expect(errors.amount).toBe("Informe um valor válido");
  });

  it("errors when amount is negative", () => {
    const errors = validateTransactionForm(form({ amount: "-10" }), noRules);
    expect(errors.amount).toBe("Informe um valor válido");
  });

  it("no amount error when amount is positive", () => {
    const errors = validateTransactionForm(form({ amount: "0.01" }), noRules);
    expect(errors.amount).toBeUndefined();
  });

  it("errors when transactionDate is empty", () => {
    const errors = validateTransactionForm(form({ transactionDate: "" }), noRules);
    expect(errors.transactionDate).toBe("Informe a data da transação");
  });

  it("errors when paymentMethod is empty", () => {
    const errors = validateTransactionForm(form({ paymentMethod: "" }), noRules);
    expect(errors.paymentMethod).toBe("Selecione a forma de pagamento");
  });
});

// ── exibirTipoCliente ──────────────────────────────────────────────────────
describe("counterpartyType validation", () => {
  it("errors when exibirTipoCliente is true and counterpartyType is empty", () => {
    const errors = validateTransactionForm(
      form({ counterpartyType: "" }),
      rules({ exibirTipoCliente: true }),
    );
    expect(errors.counterpartyType).toBe("Selecione o tipo de cliente");
  });

  it("no error when exibirTipoCliente is false, even if counterpartyType is empty", () => {
    const errors = validateTransactionForm(
      form({ counterpartyType: "" }),
      rules({ exibirTipoCliente: false }),
    );
    expect(errors.counterpartyType).toBeUndefined();
  });

  it("no error when exibirTipoCliente is true and counterpartyType is provided", () => {
    const errors = validateTransactionForm(
      form({ counterpartyType: "company" }),
      rules({ exibirTipoCliente: true }),
    );
    expect(errors.counterpartyType).toBeUndefined();
  });
});

// ── exibirCategoria ────────────────────────────────────────────────────────
describe("category validation", () => {
  it("errors when exibirCategoria is true and category is empty", () => {
    const errors = validateTransactionForm(
      form({ category: "" }),
      rules({ exibirCategoria: true }),
    );
    expect(errors.category).toBe("Selecione a categoria");
  });

  it("no error when exibirCategoria is false and category is empty", () => {
    const errors = validateTransactionForm(
      form({ category: "" }),
      rules({ exibirCategoria: false }),
    );
    expect(errors.category).toBeUndefined();
  });
});

// ── exibirSubcategoria ─────────────────────────────────────────────────────
describe("subcategory validation", () => {
  it("errors when exibirSubcategoria is true and subcategory is empty", () => {
    const errors = validateTransactionForm(
      form({ subcategory: "" }),
      rules({ exibirSubcategoria: true }),
    );
    expect(errors.subcategory).toBe("Selecione a subcategoria");
  });

  it("no error when exibirSubcategoria is false and subcategory is empty", () => {
    const errors = validateTransactionForm(
      form({ subcategory: "" }),
      rules({ exibirSubcategoria: false }),
    );
    expect(errors.subcategory).toBeUndefined();
  });
});

// ── exibirArtista ──────────────────────────────────────────────────────────
describe("artistId validation", () => {
  it("errors when exibirArtista is true and artistId is empty", () => {
    const errors = validateTransactionForm(
      form({ artistId: "" }),
      rules({ exibirArtista: true }),
    );
    expect(errors.artistId).toBe("Selecione o artista");
  });

  it("no error when exibirArtista is false and artistId is empty", () => {
    const errors = validateTransactionForm(
      form({ artistId: "" }),
      rules({ exibirArtista: false }),
    );
    expect(errors.artistId).toBeUndefined();
  });

  it("no error when exibirArtista is true and artistId is provided", () => {
    const errors = validateTransactionForm(
      form({ artistId: "artista-1" }),
      rules({ exibirArtista: true }),
    );
    expect(errors.artistId).toBeUndefined();
  });
});

// ── exibirProjeto + projetoObrigatorio ─────────────────────────────────────
describe("projectId validation", () => {
  it("errors when projeto is visible, obrigatorio, artist is linked but projeto is empty", () => {
    const errors = validateTransactionForm(
      form({ artistId: "artista-1", projectId: "" }),
      rules({ exibirProjeto: true, projetoObrigatorio: true }),
    );
    expect(errors.projectId).toBe("Selecione o projeto");
  });

  it("no error when projetoObrigatorio is false even if projeto is empty", () => {
    const errors = validateTransactionForm(
      form({ artistId: "artista-1", projectId: "" }),
      rules({ exibirProjeto: true, projetoObrigatorio: false }),
    );
    expect(errors.projectId).toBeUndefined();
  });

  it("no error when projeto is visible+obrigatorio but artistId is empty", () => {
    const errors = validateTransactionForm(
      form({ artistId: "", projectId: "" }),
      rules({ exibirProjeto: true, projetoObrigatorio: true }),
    );
    expect(errors.projectId).toBeUndefined();
  });

  it("no error when exibirProjeto is false even if all conditions are met", () => {
    const errors = validateTransactionForm(
      form({ artistId: "artista-1", projectId: "" }),
      rules({ exibirProjeto: false, projetoObrigatorio: true }),
    );
    expect(errors.projectId).toBeUndefined();
  });

  it("no error when projectId is provided", () => {
    const errors = validateTransactionForm(
      form({ artistId: "artista-1", projectId: "proj-1" }),
      rules({ exibirProjeto: true, projetoObrigatorio: true }),
    );
    expect(errors.projectId).toBeUndefined();
  });
});

// ── exibirEvento ───────────────────────────────────────────────────────────
describe("eventId validation", () => {
  it("errors when exibirEvento is true, artist is linked but evento is empty", () => {
    const errors = validateTransactionForm(
      form({ artistId: "artista-1", eventId: "" }),
      rules({ exibirEvento: true }),
    );
    expect(errors.eventId).toBe("Selecione o show/evento");
  });

  it("no error when exibirEvento is true but artistId is empty", () => {
    const errors = validateTransactionForm(
      form({ artistId: "", eventId: "" }),
      rules({ exibirEvento: true }),
    );
    expect(errors.eventId).toBeUndefined();
  });

  it("no error when exibirEvento is false even if artist is linked", () => {
    const errors = validateTransactionForm(
      form({ artistId: "artista-1", eventId: "" }),
      rules({ exibirEvento: false }),
    );
    expect(errors.eventId).toBeUndefined();
  });

  it("no error when eventId is provided", () => {
    const errors = validateTransactionForm(
      form({ artistId: "artista-1", eventId: "evento-1" }),
      rules({ exibirEvento: true }),
    );
    expect(errors.eventId).toBeUndefined();
  });
});

// ── exibirMotivoViagem ─────────────────────────────────────────────────────
describe("travelReason validation", () => {
  it("errors when exibirMotivoViagem is true and travelReason is empty", () => {
    const errors = validateTransactionForm(
      form({ travelReason: "" }),
      rules({ exibirMotivoViagem: true }),
    );
    expect(errors.travelReason).toBe("Informe o motivo da viagem");
  });

  it("errors when exibirMotivoViagem is true and travelReason is whitespace", () => {
    const errors = validateTransactionForm(
      form({ travelReason: "  " }),
      rules({ exibirMotivoViagem: true }),
    );
    expect(errors.travelReason).toBe("Informe o motivo da viagem");
  });

  it("no error when exibirMotivoViagem is false", () => {
    const errors = validateTransactionForm(
      form({ travelReason: "" }),
      rules({ exibirMotivoViagem: false }),
    );
    expect(errors.travelReason).toBeUndefined();
  });

  it("no error when travelReason is provided", () => {
    const errors = validateTransactionForm(
      form({ travelReason: "Turnê nacional" }),
      rules({ exibirMotivoViagem: true }),
    );
    expect(errors.travelReason).toBeUndefined();
  });
});

// ── exibirAdvertisingName ──────────────────────────────────────────────────
describe("advertisingName validation", () => {
  it("errors when exibirAdvertisingName is true and advertisingName is empty", () => {
    const errors = validateTransactionForm(
      form({ advertisingName: "" }),
      rules({ exibirAdvertisingName: true }),
    );
    expect(errors.advertisingName).toBe("Informe o nome da publicidade");
  });

  it("errors when advertisingName is whitespace", () => {
    const errors = validateTransactionForm(
      form({ advertisingName: "  " }),
      rules({ exibirAdvertisingName: true }),
    );
    expect(errors.advertisingName).toBe("Informe o nome da publicidade");
  });

  it("no error when exibirAdvertisingName is false", () => {
    const errors = validateTransactionForm(
      form({ advertisingName: "" }),
      rules({ exibirAdvertisingName: false }),
    );
    expect(errors.advertisingName).toBeUndefined();
  });

  it("no error when advertisingName is provided", () => {
    const errors = validateTransactionForm(
      form({ advertisingName: "Campanha Verão" }),
      rules({ exibirAdvertisingName: true }),
    );
    expect(errors.advertisingName).toBeUndefined();
  });
});

// ── exibirOrgaoArrecadador ─────────────────────────────────────────────────
describe("taxAuthority validation", () => {
  it("errors when exibirOrgaoArrecadador is true and taxAuthority is empty", () => {
    const errors = validateTransactionForm(
      form({ taxAuthority: "" }),
      rules({ exibirOrgaoArrecadador: true }),
    );
    expect(errors.taxAuthority).toBe("Selecione o órgão arrecadador");
  });

  it("no error when exibirOrgaoArrecadador is false", () => {
    const errors = validateTransactionForm(
      form({ taxAuthority: "" }),
      rules({ exibirOrgaoArrecadador: false }),
    );
    expect(errors.taxAuthority).toBeUndefined();
  });

  it("no error when taxAuthority is provided", () => {
    const errors = validateTransactionForm(
      form({ taxAuthority: "Receita Federal" }),
      rules({ exibirOrgaoArrecadador: true }),
    );
    expect(errors.taxAuthority).toBeUndefined();
  });
});

// ── exibirParcelamento ─────────────────────────────────────────────────────
describe("parcelamento validation", () => {
  it("errors on installmentCount < 2 when parcelamento is visible", () => {
    const errors = validateTransactionForm(
      form({ installmentCount: "1", firstInstallmentDate: "2026-06-01" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.installmentCount).toBe("Mínimo 2 parcelas");
  });

  it("errors on empty installmentCount when parcelamento is visible", () => {
    const errors = validateTransactionForm(
      form({ installmentCount: "", firstInstallmentDate: "2026-06-01" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.installmentCount).toBe("Mínimo 2 parcelas");
  });

  it("no error on installmentCount = 2 with date", () => {
    const errors = validateTransactionForm(
      form({ installmentCount: "2", firstInstallmentDate: "2026-06-01" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.installmentCount).toBeUndefined();
  });

  it("errors on missing firstInstallmentDate when parcelamento is visible", () => {
    const errors = validateTransactionForm(
      form({ installmentCount: "3", firstInstallmentDate: "" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.firstInstallmentDate).toBe("Informe a data da primeira parcela");
  });

  it("no error on firstInstallmentDate when provided", () => {
    const errors = validateTransactionForm(
      form({ installmentCount: "3", firstInstallmentDate: "2026-06-01" }),
      rules({ exibirParcelamento: true }),
    );
    expect(errors.firstInstallmentDate).toBeUndefined();
  });

  it("no parcelamento errors when exibirParcelamento is false", () => {
    const errors = validateTransactionForm(
      form({ installmentCount: "", firstInstallmentDate: "" }),
      rules({ exibirParcelamento: false }),
    );
    expect(errors.installmentCount).toBeUndefined();
    expect(errors.firstInstallmentDate).toBeUndefined();
  });
});

// ── multiple errors at once ────────────────────────────────────────────────
describe("multiple simultaneous errors", () => {
  it("collects all missing required fields at once", () => {
    const emptyForm: TransactionFormData = {
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
    const errors = validateTransactionForm(emptyForm, noRules);
    expect(errors.transactionType).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.amount).toBeDefined();
    expect(errors.transactionDate).toBeDefined();
    expect(errors.paymentMethod).toBeDefined();
  });
});


// ── referenceMonth (MM/YYYY) ───────────────────────────────────────────────
describe("validateTransactionForm — referenceMonth", () => {
  it("accepts blank, MM/AAAA and YYYY-MM", () => {
    for (const referenceMonth of ["", "05/2026", "2026-05"]) {
      expect(validateTransactionForm(form({ referenceMonth }), noRules).referenceMonth).toBeUndefined();
    }
  });

  it("rejects any other shape with a PT-BR message on the canonical key", () => {
    for (const referenceMonth of ["5/2026", "13/2026", "maio", "2026/05"]) {
      expect(validateTransactionForm(form({ referenceMonth }), noRules).referenceMonth)
        .toBe("Informe a competência no formato MM/AAAA");
    }
  });
});
