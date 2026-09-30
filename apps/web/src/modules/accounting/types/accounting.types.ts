import type { ArtistRef, ClientRef } from "@/shared/types/refs";
import type {
  TransactionType,
  TransactionStatusValue,
  TransactionPaymentMethod,
  TransactionCounterpartyType,
  TransactionPaymentType,
  TransactionInstallmentInterval,
  InvoiceStatusValue,
  InvoiceType,
} from "@/shared/types/enums";

export type {
  TransactionType,
  TransactionStatusValue,
  TransactionPaymentMethod,
  TransactionCounterpartyType,
  TransactionPaymentType,
  TransactionInstallmentInterval,
  InvoiceStatusValue,
  InvoiceType,
};

/** Managerial entities eligible to be linked to a financial entry (P&L traceability). */
export type TransactionEntityType =
  | "project"
  | "artist"
  | "company"
  | "campaign"
  | "event";

/**
 * Managerial link of a financial entry to a system entity.
 * Supports multiple links per entry, with an optional percentage allocation.
 */
export interface TransactionEntityLink {
  entityType: TransactionEntityType;
  entityId: string;
  entityName: string;
  /** Allocation percentage (0–100). When there are multiple links, the sum must be 100. */
  allocationPercent?: number;
}

/**
 * A `transactions` row as returned by GET /transactions (list) and the
 * POST/PUT/PATCH responses — canonical snake_case columns with canonical
 * English values (CZ-041 wire contract). `amount` is a Postgres NUMERIC and
 * arrives as a decimal string; normalize with `toNumber` before any sum.
 */
export interface Transaction {
  id: string;
  user_id?: string;
  type: TransactionType;
  category?: string | null;
  subcategory?: string | null;
  description: string | null;
  amount: number | string;
  transaction_date: string;
  status?: TransactionStatusValue | null;
  artist_id?: string | null;
  project_id?: string | null;
  contract_id?: string | null;
  event_id?: string | null;
  counterparty_type?: string | null;
  counterparty_name?: string | null;
  tax_authority?: string | null;
  cost_center?: string | null;
  reference_month?: string | null;
  source_bank_account?: string | null;
  destination_bank_account?: string | null;
  investment_item?: string | null;
  travel_reason?: string | null;
  advertising_name?: string | null;
  payment_method?: TransactionPaymentMethod | null;
  payment_type?: TransactionPaymentType | null;
  installment_count?: number | string | null;
  installment_interval?: TransactionInstallmentInterval | null;
  first_installment_date?: string | null;
  notes?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  financial_category_id?: string | null;
  financial_category_snapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  /** Managerial links mandatory for P&L consolidation (≥1). */
  entityLinks?: TransactionEntityLink[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type TransactionInsert = Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at" | keyof { [key: string]: unknown }>;
export type TransactionUpdate = Partial<TransactionInsert>;

export interface TransactionWithRelations extends Transaction {
  artistas?: ArtistRef | null;
  clientes?: ClientRef | null;
}

export interface Invoice {
  id: string;
  user_id?: string;
  invoice_number?: string | null;
  serie?: string | null;
  tipo_nota?: InvoiceType | string | null;
  status?: InvoiceStatusValue | string | null;
  tomador_name?: string | null;
  tomador_cnpj?: string | null;
  total_amount?: number | null;
  service_amount?: number | null;
  iss_amount?: number | null;
  issued_at?: string | null;
  due_at?: string | null;
  service_description?: string | null;
  client_id?: string | null;
  sale_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type InvoiceInsert = Omit<Invoice, "id" | "user_id" | "created_at" | "updated_at">;
export type InvoiceUpdate = Partial<InvoiceInsert>;

/** The invoices API embeds no relation; the client name is resolved by `client_id`. */
export type InvoiceWithRelations = Invoice;

