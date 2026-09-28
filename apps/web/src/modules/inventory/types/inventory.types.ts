import type { InventoryStatus } from "@music-os-360/types";

export type { InventoryStatus };

/** Inventory item as the API returns it (canonical English fields, CZ-032). */
export interface InventoryItem {
  id: string;
  name: string;
  category?: string | null;
  quantity?: number | null;
  unit_price?: number | string | null;
  storage_location?: string | null;
  status?: InventoryStatus | string | null;
  responsible_person?: string | null;
  sector?: string | null;
  entry_date?: string | null;
  purchase_location?: string | null;
  numero_nota_fiscal?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type InventoryInsert = Omit<InventoryItem, "id" | "created_at" | "updated_at">;
export type InventoryUpdate = Partial<InventoryInsert>;
