// @music-os-360 — inventory constants
import { InventoryStatus } from "@music-os-360/types";

/** Status values offered by the inventory form, in display order. */
export const INVENTORY_STATUS_VALUES: InventoryStatus[] = Object.values(InventoryStatus);

export function isInventoryStatus(value: unknown): value is InventoryStatus {
  return typeof value === "string" && (INVENTORY_STATUS_VALUES as string[]).includes(value);
}
