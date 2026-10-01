/**
 * accounting/services/entity-to-form.mapper.ts
 * Transaction row → form field values. Source of truth for Transaction hydration.
 */

import { calendarDay } from "@/shared/lib/format-utils";
import { canonicalTransactionCategory, initialFormData } from "@/modules/accounting/constants/transaction-constants";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

/**
 * The `transactions` row the edit form is hydrated from (GET /transactions
 * list row / mutation response): canonical snake_case columns of the CZ-041
 * wire contract, canonical English values. Only those columns are read — the
 * legacy Portuguese columns (descricao, valor, data, categoria, contrato_id,
 * evento_id, ...) no longer exist in the response.
 */
export interface TransactionFormEntity {
  id?: string;
  updated_at?: unknown;
  type?: unknown;
  counterparty_type?: unknown;
  category?: unknown;
  subcategory?: unknown;
  description?: unknown;
  amount?: unknown;
  transaction_date?: unknown;
  status?: unknown;
  notes?: unknown;
  artist_id?: unknown;
  project_id?: unknown;
  contract_id?: unknown;
  event_id?: unknown;
  counterparty_name?: unknown;
  tax_authority?: unknown;
  cost_center?: unknown;
  reference_month?: unknown;
  source_bank_account?: unknown;
  destination_bank_account?: unknown;
  investment_item?: unknown;
  travel_reason?: unknown;
  advertising_name?: unknown;
  payment_method?: unknown;
  payment_type?: unknown;
  installment_count?: unknown;
  installment_interval?: unknown;
  first_installment_date?: unknown;
  attachment_url?: unknown;
  attachment_name?: unknown;
  entityLinks?: unknown;
}

/** Wire "YYYY-MM" → the form's PT-BR "MM/AAAA" input convention (inverse of toReferenceMonth). */
function toReferenceMonthInput(value: string): string {
  const iso = /^(\d{4})-(\d{2})$/.exec(value);
  return iso ? `${iso[2]}/${iso[1]}` : value;
}

export function transactionToFormFields(t: TransactionFormEntity | null | undefined): TransactionFormData {
  if (!t) return { ...initialFormData };
  const str = (v: unknown): string => (v == null ? "" : String(v).trim());
  return {
    ...initialFormData,
    entityLinks: Array.isArray(t.entityLinks) ? (t.entityLinks as TransactionFormData["entityLinks"]) : [],
    transactionType:        str(t.type),
    counterpartyType:       str(t.counterparty_type),
    category:               canonicalTransactionCategory(str(t.category)),
    subcategory:            canonicalTransactionCategory(str(t.subcategory)),
    description:            str(t.description),
    amount:                 str(t.amount),
    transactionDate:        calendarDay(t.transaction_date),
    status:                 str(t.status)                 || initialFormData.status,
    notes:                  str(t.notes),
    artistId:               str(t.artist_id),
    projectId:              str(t.project_id),
    contractId:             str(t.contract_id),
    eventId:                str(t.event_id),
    counterpartyName:       str(t.counterparty_name),
    taxAuthority:           str(t.tax_authority),
    costCenter:             str(t.cost_center),
    referenceMonth:         toReferenceMonthInput(str(t.reference_month)),
    sourceBankAccount:      str(t.source_bank_account),
    destinationBankAccount: str(t.destination_bank_account),
    investmentItem:         str(t.investment_item),
    travelReason:           str(t.travel_reason),
    advertisingName:        str(t.advertising_name),
    paymentMethod:          str(t.payment_method),
    paymentType:            str(t.payment_type)           || initialFormData.paymentType,
    installmentCount:       str(t.installment_count),
    installmentInterval:    str(t.installment_interval)   || initialFormData.installmentInterval,
    firstInstallmentDate:   calendarDay(t.first_installment_date),
    attachmentUrl:          str(t.attachment_url),
    attachmentName:         str(t.attachment_name),
  };
}
