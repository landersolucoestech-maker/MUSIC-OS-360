import { TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR } from "@music-os-360/types";

/**
 * `invoices.payment_method` wire values. The canonical values are the SAME
 * vocabulary the ledger uses for `transactions.payment_method`
 * (TransactionPaymentMethod: pix | ted | boleto | credit_card | debit_card |
 * cash | check); PT-BR labels come from the shared registry
 * (TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR), never from the value itself.
 *
 * `transferencia` is the one persisted value with NO unambiguous canonical
 * equivalent (`ted` is a single payment rail, not a generic bank transfer) and
 * the canonical map has not decided a new value yet: it is kept as-is and
 * listed here explicitly rather than guessed. The API keeps accepting it
 * (INVOICE_PAYMENT_METHODS) until that decision is taken.
 */
export const INVOICE_PAYMENT_METHOD_PENDING_DECISION = "transferencia";

export const invoicePaymentMethodOptions: ReadonlyArray<{ value: string; label: string }> = [
  { value: "cash", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.cash },
  { value: "pix", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.pix },
  { value: INVOICE_PAYMENT_METHOD_PENDING_DECISION, label: "Transferência" },
  { value: "boleto", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.boleto },
  { value: "credit_card", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.credit_card },
  { value: "debit_card", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.debit_card },
  { value: "check", label: TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR.check },
];

/** PT-BR label of every stored payment method (the form offers a subset; `ted` may come from the API or an import). */
const paymentMethodLabels: Readonly<Record<string, string>> = {
  ...TRANSACTION_PAYMENT_METHOD_LABELS_PT_BR,
  [INVOICE_PAYMENT_METHOD_PENDING_DECISION]: "Transferência",
};

/**
 * TEMPORARY_MIGRATION_COMPATIBILITY (read side). Rows written before migration
 * 20260930000010 (BackfillAndRestrictInvoicePaymentMethodToEnglish) still hold
 * the Portuguese value until it has run in the environment the API serves.
 * Removal condition: that migration applied in every environment.
 */
const LEGACY_PAYMENT_METHODS: Readonly<Record<string, string>> = {
  dinheiro: "cash",
  cartao_credito: "credit_card",
  cartao_debito: "debit_card",
  cheque: "check",
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
