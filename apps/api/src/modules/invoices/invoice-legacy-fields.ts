/**
 * invoice-legacy-fields.ts — CZ-036 deploy-skew compatibility for the invoice
 * contract.
 *
 * Generic invoice field names are English; official Brazilian fiscal (NFS-e)
 * terms keep their names (canonical map PRODUCT_TERM exceptions). A web build
 * released before CZ-036 sends the Portuguese names below (and `codigo_servico`
 * / `quantidade` inside each item); they are accepted as deprecated input and
 * moved here before persistence. Responses are canonical.
 */
import type { DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import { PAYMENT_METHODS } from '../transactions/transaction-legacy-fields';

export const INVOICE_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  numero: 'invoice_number',
  venda_id: 'sale_id',
  data_emissao: 'issued_at',
  vencimento: 'due_at',
  tomador_razao_social: 'tomador_legal_name',
  forma_pagamento: 'payment_method',
  condicao_pagamento: 'payment_terms',
  itens: 'items',
};

export const INVOICE_ITEM_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  codigo_servico: 'service_code',
  quantidade: 'quantity',
};

/**
 * invoices.payment_method vocabulary. The canonical values are the SAME payment
 * method vocabulary the ledger already uses (transactions.payment_method,
 * PAYMENT_METHODS) -- one concept, one vocabulary.
 *
 * `transferencia` is a persisted value with NO unambiguous canonical
 * equivalent: `ted` is one specific payment rail, a generic bank transfer is
 * not, and adding a new value (e.g. `bank_transfer`) is a canonical-map
 * decision that has not been made. It is therefore NOT mapped (never guessed)
 * and stays a valid stored value until that decision is taken; the
 * chk_invoices_payment_method CHECK lists it explicitly for that reason.
 */
export const INVOICE_PAYMENT_METHOD_PENDING_DECISION = 'transferencia';
export const INVOICE_PAYMENT_METHODS: readonly string[] = [...PAYMENT_METHODS, INVOICE_PAYMENT_METHOD_PENDING_DECISION];

/**
 * Deprecated Portuguese value -> canonical value (input from a web build that
 * predates the vocabulary change, old spreadsheets, and rows not yet
 * backfilled). `pix` and `boleto` are payment-rail proper names, already
 * canonical.
 */
export const LEGACY_INVOICE_PAYMENT_METHODS: Readonly<Record<string, string>> = {
  dinheiro: 'cash',
  cartao_credito: 'credit_card',
  cartao_debito: 'debit_card',
  cheque: 'check',
};

/** Canonical payment method of a raw value (deprecated spellings mapped, case/space-insensitive; unknown values are returned unchanged, never guessed). */
export function canonicalInvoicePaymentMethod(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(LEGACY_INVOICE_PAYMENT_METHODS, key)) return LEGACY_INVOICE_PAYMENT_METHODS[key];
  return INVOICE_PAYMENT_METHODS.includes(key) ? key : value;
}
