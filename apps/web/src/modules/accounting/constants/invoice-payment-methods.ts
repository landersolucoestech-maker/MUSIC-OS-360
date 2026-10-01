import { TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR } from "@music-os-360/types";

/**
 * `invoices.payment_method` wire values. The canonical values are the SAME
 * vocabulary the ledger uses for `transactions.payment_method`
 * (TransactionPaymentMethod: pix | ted | boleto | credit_card | debit_card |
 * cash | check) plus `bank_transfer`; PT-BR labels come from the shared
 * registry (TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR), never from the value.
 *
 * `bank_transfer` is the canonical payment-rail value of a generic bank
 * transfer (`ted` is one specific rail; `transfer` is the transaction TYPE).
 * The legacy Portuguese `transferencia` is still READ (stored rows not yet
 * backfilled by migration 20260930000021) and mapped to `bank_transfer`.
 */
export const INVOICE_PAYMENT_METHOD_BANK_TRANSFER = "bank_transfer";
export const LEGACY_INVOICE_PAYMENT_METHOD_TRANSFER = "transferencia";
export const BANK_TRANSFER_LABEL_PT_BR = "Transferência";

export const invoicePaymentMethodOptions: ReadonlyArray<{ value: string; label: string }> = [
  { value: "cash", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.cash },
  { value: "pix", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.pix },
  { value: INVOICE_PAYMENT_METHOD_BANK_TRANSFER, label: BANK_TRANSFER_LABEL_PT_BR },
  { value: "boleto", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.boleto },
  { value: "credit_card", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.credit_card },
  { value: "debit_card", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.debit_card },
  { value: "check", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.check },
];

/** PT-BR label of every stored payment method (the form offers a subset; `ted` may come from the API or an import). */
const paymentMethodLabels: Readonly<Record<string, string>> = {
  ...TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR,
  [INVOICE_PAYMENT_METHOD_BANK_TRANSFER]: BANK_TRANSFER_LABEL_PT_BR,
};

/**
 * TEMPORARY_MIGRATION_COMPATIBILITY (read side). Rows written before migration
 * 20260930000010 (BackfillAndRestrictInvoicePaymentMethodToEnglish) still hold
 * the Portuguese value until it has run in the environment the API serves.
 * Removal condition: that migration (and 20260930000021 for transferencia) applied in every environment.
 */
const LEGACY_PAYMENT_METHODS: Readonly<Record<string, string>> = {
  dinheiro: "cash",
  cartao_credito: "credit_card",
  cartao_debito: "debit_card",
  cheque: "check",
  [LEGACY_INVOICE_PAYMENT_METHOD_TRANSFER]: INVOICE_PAYMENT_METHOD_BANK_TRANSFER,
};

/** Canonical value of a stored payment method (deprecated Portuguese spellings mapped; anything else returned unchanged). */
export function canonicalInvoicePaymentMethod(value: string | null | undefined): string {
  if (!value) return "";
  const key = value.trim().toLowerCase();
  return LEGACY_PAYMENT_METHODS[key] ?? key;
}

/** PT-BR label of a stored payment method; an unknown value is shown as-is, never hidden. */
export function invoicePaymentMethodLabel(value: string | null | undefined): string {
  const canonical = canonicalInvoicePaymentMethod(value);
  return paymentMethodLabels[canonical] ?? value ?? "";
}
