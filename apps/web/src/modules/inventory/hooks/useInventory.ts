import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { InventoryItem, InventoryInsert, InventoryUpdate } from "../types/inventory.types";

export type { InventoryItem, InventoryInsert, InventoryUpdate };

export function useInventory() {
  const result = useDataQuery<InventoryItem>({
    queryKey: [...QUERY_KEYS.INVENTORY],
    table: "inventory_items",
  }, {
    create: { success: "Item criado com sucesso!", error: "Erro ao criar item" },
    update: { success: "Item atualizado com sucesso!", error: "Erro ao atualizar item" },
    delete: { success: "Item excluído com sucesso!", error: "Erro ao excluir item" },
  });

  return {
    inventoryItems: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addInventoryItem: result.create,
    updateInventoryItem: result.update,
    deleteInventoryItem: result.delete,
  };
}
