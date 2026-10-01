import { describe, it, expect } from "vitest";
import { formToTransactionPayload, toReferenceMonth } from "./form-to-payload.mapper";
import { transactionToFormFields } from "./entity-to-form.mapper";
import {
  initialFormData,
  installmentIntervals,
  paymentMethods,
  paymentTypes,
  transactionTypes,
  counterpartyTypes,
  type TransactionFormData,
} from "@/modules/accounting/constants/transaction-constants";

/** Exact CZ-041 request-body key set (camelCase English). */
const CANONICAL_KEYS = [
  "transactionType", "counterpartyType", "category", "subcategory", "description", "amount",
  "transactionDate", "status", "notes", "artistId", "projectId", "contractId", "eventId",
  "counterpartyName", "taxAuthority", "costCenter", "referenceMonth", "sourceBankAccount",
  "destinationBankAccount", "investmentItem", "travelReason", "advertisingName", "paymentMethod",
  "paymentType", "installmentCount", "installmentInterval", "firstInstallmentDate",
  "attachmentUrl", "attachmentName",
].sort();

/** Legacy Portuguese / snake_case keys the web must never send again. */
const LEGACY_KEYS = [
  "tipoTransacao", "tipoCliente", "subcategoria", "dataTransacao", "observacao", "artistaVinculado",
  "projetoVinculado", "contratoVinculado", "eventoVinculado", "fornecedorCliente", "orgaoArrecadador",
  "centro_custo", "competencia", "conta_origem", "conta_destino", "itemInvestimento", "motivoViagem",
  "formaPagamento", "tipoPagamento", "quantidadeParcelas", "intervaloParcelas", "dataPrimeiraParcela",
  "anexoUrl", "anexoNome", "entityLinks",
];

const LEGACY_VALUES = [
  "receita", "despesa", "investimento", "imposto", "transferencia", "empresa", "artista", "pessoa",
  "cartao-credito", "cartao-debito", "dinheiro", "cheque", "avista", "parcelado", "mensal", "quinzenal", "semanal",
];

const filled: TransactionFormData = {
  ...initialFormData,
  transactionType: "expense",
  counterpartyType: "company",
  category: "services",
  subcategory: "graphic_design",
  description: "  Capa do single  ",
  amount: "1.234,56",
  transactionDate: "2026-05-10",
  status: "paid",
  notes: "obs",
  artistId: "a1",
  projectId: "p1",
  contractId: "c1",
  eventId: "e1",
  counterpartyName: "Estúdio X",
  taxAuthority: "",
  linkType: "project",
  costCenter: "CC-01",
  referenceMonth: "05/2026",
  sourceBankAccount: "Itaú 123",
  destinationBankAccount: "Nubank 456",
  investmentItem: "",
  travelReason: "",
  advertisingName: "",
  paymentMethod: "credit_card",
  paymentType: "installments",
  installmentCount: "3",
  installmentInterval: "biweekly",
  firstInstallmentDate: "2026-06-10",
  attachmentUrl: "https://files/x.pdf",
  attachmentName: "x.pdf",
};

describe("formToTransactionPayload — CZ-041 canonical request body", () => {
  it("emits exactly the canonical key set (no PT/snake_case keys, no form-only keys)", () => {
    const payload = formToTransactionPayload(filled);
    expect(Object.keys(payload).sort()).toEqual(CANONICAL_KEYS);
    for (const legacy of LEGACY_KEYS) expect(payload).not.toHaveProperty(legacy);
    expect(payload).not.toHaveProperty("linkType");
  });

  it("forwards canonical English values and the fields the API used to drop", () => {
    expect(formToTransactionPayload(filled)).toEqual({
      transactionType: "expense",
      counterpartyType: "company",
      category: "services",
      subcategory: "graphic_design",
      description: "Capa do single",
      amount: 1234.56,
      transactionDate: "2026-05-10",
      status: "paid",
      notes: "obs",
      artistId: "a1",
      projectId: "p1",
      contractId: "c1",
      eventId: "e1",
      counterpartyName: "Estúdio X",
      taxAuthority: null,
      costCenter: "CC-01",
      referenceMonth: "2026-05",
      sourceBankAccount: "Itaú 123",
      destinationBankAccount: "Nubank 456",
      investmentItem: null,
      travelReason: null,
      advertisingName: null,
      paymentMethod: "credit_card",
      paymentType: "installments",
      installmentCount: "3",
      installmentInterval: "biweekly",
      firstInstallmentDate: "2026-06-10",
      attachmentUrl: "https://files/x.pdf",
      attachmentName: "x.pdf",
    });
  });

  it("sends blank optional fields as null (and keeps the form defaults canonical)", () => {
    const payload = formToTransactionPayload({ ...initialFormData });
    const { status, paymentType, installmentInterval, ...rest } = payload;
    expect(status).toBe("pending");
    expect(paymentType).toBe("upfront");
    expect(installmentInterval).toBe("monthly");
    for (const [key, value] of Object.entries(rest)) {
      expect(`${key}=${String(value)}`).toBe(`${key}=null`);
    }
  });

  it("never persists a local blob: preview URL", () => {
    expect(formToTransactionPayload({ ...filled, attachmentUrl: "blob:http://x/1" }).attachmentUrl).toBeNull();
  });

  it("no option list offers a legacy Portuguese value", () => {
    const values = [transactionTypes, counterpartyTypes, paymentMethods, paymentTypes, installmentIntervals]
      .flat()
      .map((o) => o.value as string);
    for (const legacy of LEGACY_VALUES) expect(values).not.toContain(legacy);
  });
});

describe("toReferenceMonth", () => {
  it("converts the PT-BR input MM/AAAA to the wire YYYY-MM", () => {
    expect(toReferenceMonth("05/2026")).toBe("2026-05");
  });
  it("keeps YYYY-MM and blank → null", () => {
    expect(toReferenceMonth("2026-05")).toBe("2026-05");
    expect(toReferenceMonth("  ")).toBeNull();
    expect(toReferenceMonth(undefined)).toBeNull();
  });
});

describe("transactionToFormFields — reads canonical snake_case columns", () => {
  it("round-trips a canonical row back into the same request body", () => {
    const row = {
      id: "t1",
      type: "expense",
      counterparty_type: "company",
      category: "services",
      subcategory: "graphic_design",
      description: "Capa do single",
      amount: "1234.56",
      transaction_date: "2026-05-10",
      status: "paid",
      notes: "obs",
      artist_id: "a1",
      project_id: "p1",
      contract_id: "c1",
      event_id: "e1",
      counterparty_name: "Estúdio X",
      tax_authority: null,
      cost_center: "CC-01",
      reference_month: "2026-05",
      source_bank_account: "Itaú 123",
      destination_bank_account: "Nubank 456",
      investment_item: null,
      travel_reason: null,
      advertising_name: null,
      payment_method: "credit_card",
      payment_type: "installments",
      installment_count: 3,
      installment_interval: "biweekly",
      first_installment_date: "2026-06-10",
      attachment_url: "https://files/x.pdf",
      attachment_name: "x.pdf",
    };
    const form = transactionToFormFields(row);
    expect(form.referenceMonth).toBe("05/2026");
    expect(formToTransactionPayload(form)).toEqual({
      ...formToTransactionPayload(filled),
      amount: 1234.56,
    });
  });

  it("ignores legacy Portuguese columns (they no longer exist in the response)", () => {
    const form = transactionToFormFields({ descricao: "x", valor: "10", data: "2026-01-01" } as never);
    expect(form.description).toBe("");
    expect(form.amount).toBe("");
    expect(form.transactionDate).toBe("");
  });
});
