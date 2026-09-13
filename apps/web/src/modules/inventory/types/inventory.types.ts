import type { InventoryStatus } from "@/shared/types/enums";

export type { InventoryStatus };

export interface InventarioItem {
  id: string;
  user_id?: string;
  nome: string;
  categoria?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  localizacao?: string | null;
  status?: InventoryStatus | string | null;
  responsavel?: string | null;
  setor?: string | null;
  dataEntrada?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type InventarioInsert = Omit<InventarioItem, "id" | "user_id" | "created_at" | "updated_at">;
export type InventarioUpdate = Partial<InventarioInsert>;
