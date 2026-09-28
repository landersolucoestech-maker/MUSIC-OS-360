/**
 * One concept, one canonical name (see docs/naming/canonical-naming-map.json
 * and .claude/rules/naming-canonical.md). The contract of this DTO is English.
 * Since CZ-041 every field below comes from a canonical physical column of
 * `transactions` (`description`, `amount`, `transaction_date`, `category`,
 * `subcategory`, `notes`, `payment_method`, `payment_type`, `installment_count`,
 * `counterparty_name`, `event_id`, `contract_id`, `reference_month`,
 * `cost_center`, ...) — the mapping lives only in `toTransactionDetails()`
 * (read) and in the service's FIELD_TO_COLUMN (write), both in
 * `transactions.service.ts`. `metadata` is historical data plus the optional
 * enrichment keys (grossAmount, fees, attachments, ...).
 *
 * Recorded naming decisions (kept for response compatibility):
 *  - `transactionDate` (column transaction_date), not `date`: the DTO also has
 *    `dueDate`, `paidAt` and `competence`.
 *  - `note` (column notes), `installments` (column installment_count; distinct
 *    from `installmentCurrent`), `supplierOrClient` (column counterparty_name;
 *    `supplier` is a different, never-written metadata key), `linkedEventId`
 *    (column event_id), `competence` (column reference_month).
 */
export interface TransactionDetailsDTO {
  id: string;
  type: string;
  status: string;
  description: string | null;
  note?: string | null;
  amount: number;
  grossAmount?: number | null;
  netAmount?: number | null;
  fees?: number | null;
  discount?: number | null;
  taxes?: number | null;
  interest?: number | null;
  fine?: number | null;
  currency?: string | null;
  transactionDate?: string | null;
  competence?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  recurrence?: string | null;
  paymentMethod?: string | null;
  paymentType?: string | null;
  installments?: number | string | null;
  installmentCurrent?: number | null;
  bankAccount?: Record<string, unknown> | string | null;
  category?: string | null;
  subcategory?: string | null;
  costCenter?: Record<string, unknown> | string | null;
  tags?: string[];
  labels?: string[];
  attachments?: Array<Record<string, unknown>>;
  artist?: Record<string, unknown> | null;
  artistId?: string | null;
  project?: Record<string, unknown> | null;
  projectId?: string | null;
  campaign?: Record<string, unknown> | null;
  contract?: Record<string, unknown> | null;
  contractId?: string | null;
  release?: Record<string, unknown> | null;
  event?: Record<string, unknown> | null;
  linkedEventId?: string | null;
  supplierOrClient?: string | null;
  supplier?: Record<string, unknown> | string | null;
  metadata: Record<string, unknown>;
  createdBy?: Record<string, unknown> | string | null;
  updatedBy?: Record<string, unknown> | string | null;
  created_at: string;
  updated_at: string;
}
