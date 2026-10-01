// @music-os-360 — inventory constants
import { InventoryStatus } from "@music-os-360/types";

/** Status values offered by the inventory form, in display order. */
export const INVENTORY_STATUS_VALUES: InventoryStatus[] = Object.values(InventoryStatus);

export function isInventoryStatus(value: unknown): value is InventoryStatus {
  return typeof value === "string" && (INVENTORY_STATUS_VALUES as string[]).includes(value);
}

/**
 * Inventory categories. `inventory_items.category` is a free-text varchar(100) that
 * persists the display text (the API only filters it with ILIKE), so the stored
 * value IS the PT-BR label. One shared list feeds the form and the list filter so
 * both always use the exact persisted spelling (with accents).
 * NEEDS_API_SLICE: canonical English slug column/CHECK + backfill (audio, computer, ...).
 */
export const INVENTORY_CATEGORY_OPTIONS = [
  "Áudio",
  "Computador",
  "Escritório",
  "Estrutura",
  "Iluminação",
  "Mobília",
  "Software",
  "Vídeo",
  "Outros",
] as const;
