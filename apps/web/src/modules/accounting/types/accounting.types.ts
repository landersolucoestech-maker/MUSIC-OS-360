import type { ArtistRef, ClientRef } from "@/shared/types/refs";
import type {
  TransactionType,
  TransactionStatusValue,
  TransactionPaymentMethod,
  InvoiceStatusValue,
  InvoiceType,
} from "@/shared/types/enums";

export type { TransactionType, TransactionStatusValue, TransactionPaymentMethod, InvoiceStatusValue, InvoiceType };

/** Managerial entities eligible to be linked to a financial entry (P&L traceability). */
export type TransactionEntityType =
  | "projeto"
  | "artista"
  | "empresa"
  | "campanha"
  | "evento";

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

export interface Transaction {
  id: string;
  user_id?: string;
  descricao: string;
  type: TransactionType | string;
  categoria?: string | null;
  valor: number;
  data: string;
  status?: TransactionStatusValue | string | null;
  artist_id?: string | null;
  client_id?: string | null;
  venda_id?: string | null;
  /** Managerial links mandatory for P&L consolidation (≥1). */
  entityLinks?: TransactionEntityLink[];
  origem?: string | null;
  notes?: string | null;
  conciliado?: boolean | null;
  anexo_url?: string | null;
  forma_pagamento?: TransactionPaymentMethod | string | null;
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

export interface InvoiceWithRelations extends Invoice {
  clientes?: ClientRef | null;
}

