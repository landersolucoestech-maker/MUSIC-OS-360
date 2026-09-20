import type { InventoryStatus } from "@/shared/types/enums";

export type { InventoryStatus };

export interface InventarioItem {
  id: string;
  user_id?: string;
  name: string;
  category?: string | null;
  quantidade?: number | null;
  unit_price?: number | null;
  /** @deprecated physical column renamed to `unit_price` (Cluster G) — kept for back-compat reads of stale cached data. */
  valor_unitario?: number | null;
  localizacao?: string | null;
  status?: InventoryStatus | string | null;
  responsavel?: string | null;
  setor?: string | null;
  dataEntrada?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type InventarioInsert = Omit<InventarioItem, "id" | "user_id" | "created_at" | "updated_at">;
export type InventarioUpdate = Partial<InventarioInsert>;
