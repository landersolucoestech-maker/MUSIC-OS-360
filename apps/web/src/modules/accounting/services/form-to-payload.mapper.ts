/**
 * accounting/services/form-to-payload.mapper.ts
 * Form field values → API request body. Source of truth for Transaction persistence.
 */

import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import { canonicalTransactionSlug } from "@/modules/accounting/constants/transaction-category-slugs";

/**
 * Request body of POST/PUT/PATCH /transactions — exactly the canonical
 * camelCase English keys of the CZ-041 wire contract, one key per concept
 * (see .claude/rules/naming-canonical.md). The web sends ONLY these keys; the
 * deprecated Portuguese keys the API still tolerates during the deploy window
 * are never emitted here.
 *
 * A blank optional form field is sent as `null` (the API accepts `null` for
 * every optional field). costCenter/referenceMonth/sourceBankAccount/
 * destinationBankAccount used to be sent as snake_case keys the API silently
 * discarded; they are now real contract keys.
 *
 * Values of transactionType/counterpartyType/paymentMethod/paymentType/
 * installmentInterval are the canonical English values carried by the form
 * state itself (see transaction-constants.ts option lists) — no translation
 * happens here. Category/subcategory slugs are forwarded as the canonical English ids (a legacy slug in a loaded row is mapped; free text is unchanged).
 */
export interface TransactionFormPayload {
  transactionType: string | null;
  counterpartyType: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number | null;
  transactionDate: string | null;
  status: string;
  notes: string | null;
  artistId: string | null;
  projectId: string | null;
  contractId: string | null;
  eventId: string | null;
  counterpartyName: string | null;
  taxAuthority: string | null;
  costCenter: string | null;
  referenceMonth: string | null;
  sourceBankAccount: string | null;
  destinationBankAccount: string | null;
  investmentItem: string | null;
  travelReason: string | null;
  advertisingName: string | null;
  paymentMethod: string | null;
  paymentType: string | null;
  installmentCount: string | null;
  installmentInterval: string | null;
  firstInstallmentDate: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
}

/**
 * The form collects the reference month as "MM/AAAA" (PT-BR convention, see
 * the "Competência" field); the wire contract is "YYYY-MM". Anything that is
 * neither shape is forwarded trimmed so the API validation rejects it visibly
 * (the form validation already blocks it before submit).
 */
export function toReferenceMonth(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const brazilian = /^(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brazilian) return `${brazilian[2]}-${brazilian[1]}`;
  return trimmed;
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function formToTransactionPayload(f: TransactionFormData): TransactionFormPayload {
  const str = (v: string | undefined): string | null => v?.trim() || null;
  const attachmentUrl = str(f.attachmentUrl);

  return {
    transactionType:        str(f.transactionType),
    counterpartyType:       str(f.counterpartyType),
    category:               canonicalTransactionSlug(str(f.category)),
    subcategory:            canonicalTransactionSlug(str(f.subcategory)),
    description:            str(f.description),
    amount:                 parseMoney(f.amount),
    transactionDate:        str(f.transactionDate),
    status:                 str(f.status) ?? "pending",
    notes:                  str(f.notes),
    artistId:               str(f.artistId),
    projectId:              str(f.projectId),
    contractId:             str(f.contractId),
    eventId:                str(f.eventId),
    counterpartyName:       str(f.counterpartyName),
    taxAuthority:           str(f.taxAuthority),
    costCenter:             str(f.costCenter),
    referenceMonth:         toReferenceMonth(f.referenceMonth),
    sourceBankAccount:      str(f.sourceBankAccount),
    destinationBankAccount: str(f.destinationBankAccount),
    investmentItem:         str(f.investmentItem),
    travelReason:           str(f.travelReason),
    advertisingName:        str(f.advertisingName),
    paymentMethod:          str(f.paymentMethod),
    paymentType:            str(f.paymentType),
    installmentCount:       str(f.installmentCount),
    installmentInterval:    str(f.installmentInterval),
    firstInstallmentDate:   str(f.firstInstallmentDate),
    // A blob: URL is a local, not-yet-uploaded preview — never persisted.
    attachmentUrl:          attachmentUrl?.startsWith("blob:") ? null : attachmentUrl,
    attachmentName:         str(f.attachmentName),
  };
}
