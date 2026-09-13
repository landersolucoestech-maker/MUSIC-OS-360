import type { ClienteRef } from "@/shared/types/refs";
import type { LicenseType, LicenseStatus } from "@/shared/types/enums";

export type { LicenseType, LicenseStatus };

export type RemunerationType = "FIXED" | "PERCENTAGE" | "FIXED_PLUS_PERCENTAGE";
export type Currency = "BRL" | "USD" | "EUR";

export interface Licenca {
  id: string;
  user_id?: string;
  title: string;
  // Relações (fonte da verdade)
  work_id?: string | null;
  client_id?: string | null;
  projeto?: string | null;
  type?: LicenseType | string | null;
  tipo_uso?: string | null;
  midia_destino?: string | null;
  territorio?: string | null;
  status?: LicenseStatus | string | null;
  start_date?: string | null;
  end_date?: string | null;
  // Remuneração estruturada
  remuneration_type?: RemunerationType | null;
  currency?: Currency | null;
  amount?: number | null;
  percentage?: number | null;
  /** @deprecated valor monetário legado — leitura/back-compat; novo modelo usa `amount`. */
  valor?: number | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type LicencaInsert = Omit<Licenca, "id" | "user_id" | "created_at" | "updated_at">;
export type LicencaUpdate = Partial<LicencaInsert>;

export interface LicencaWithRelations extends Licenca {
  clientes?: ClienteRef | null;
}
