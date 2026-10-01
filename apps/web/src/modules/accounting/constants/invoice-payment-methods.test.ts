import { describe, expect, it } from "vitest";
import { paymentMethods } from "./transaction-constants";
import {
  INVOICE_PAYMENT_METHOD_BANK_TRANSFER,
  canonicalInvoicePaymentMethod,
  invoicePaymentMethodLabel,
  invoicePaymentMethodOptions,
} from "./invoice-payment-methods";

describe("invoice payment methods (invoices.payment_method wire values)", () => {
  it("offers only values of the transactions vocabulary plus bank_transfer", () => {
    const canonical = new Set(paymentMethods.map((option) => option.value as string));
    const offered = invoicePaymentMethodOptions.map((option) => option.value);
    expect(offered.filter((value) => !canonical.has(value))).toEqual([INVOICE_PAYMENT_METHOD_BANK_TRANSFER]);
  });

  it("keeps the visible PT-BR labels and their order unchanged", () => {
    expect(invoicePaymentMethodOptions.map((option) => option.label)).toEqual([
      "Dinheiro", "PIX", "Transferência", "Boleto", "Cartão de Crédito", "Cartão de Débito", "Cheque",
    ]);
  });

  it("labels agree with the transactions option labels for every shared value", () => {
    const transactionLabels = new Map(paymentMethods.map((option) => [option.value as string, option.label]));
    for (const option of invoicePaymentMethodOptions) {
      if (transactionLabels.has(option.value)) expect(option.label).toBe(transactionLabels.get(option.value));
    }
  });

  it.each([
    ["dinheiro", "cash"], ["cartao_credito", "credit_card"], ["cartao_debito", "debit_card"], ["cheque", "check"],
    ["cash", "cash"], ["pix", "pix"], ["boleto", "boleto"], ["transferencia", "bank_transfer"], [" Transferencia ", "bank_transfer"], ["bank_transfer", "bank_transfer"],
  ])("reads the stored value %s as %s", (stored, canonical) => {
    expect(canonicalInvoicePaymentMethod(stored)).toBe(canonical);
  });

  it("never invents a value for an empty method", () => {
    expect(canonicalInvoicePaymentMethod(null)).toBe("");
    expect(canonicalInvoicePaymentMethod(undefined)).toBe("");
    expect(invoicePaymentMethodLabel(null)).toBe("");
  });

  it.each([
    ["cash", "Dinheiro"], ["dinheiro", "Dinheiro"], ["credit_card", "Cartão de Crédito"], ["cartao_credito", "Cartão de Crédito"],
    ["debit_card", "Cartão de Débito"], ["check", "Cheque"], ["pix", "PIX"], ["ted", "TED"], ["transferencia", "Transferência"], ["bank_transfer", "Transferência"],
  ])("labels %s as %s", (stored, label) => {
    expect(invoicePaymentMethodLabel(stored)).toBe(label);
  });

  it("shows an unknown stored value as-is (not hidden, not relabeled)", () => {
    expect(invoicePaymentMethodLabel("alien")).toBe("alien");
  });
});
