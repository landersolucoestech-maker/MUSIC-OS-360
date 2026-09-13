import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { InventarioItem, InventarioInsert, InventarioUpdate } from "../types/inventory.types";

export type { InventarioItem, InventarioInsert, InventarioUpdate };

export function useInventario() {
  const result = useDataQuery<InventarioItem>({
    queryKey: [...QUERY_KEYS.INVENTORY],
    table: "inventario",
  }, {
    create: { success: "Item criado com sucesso!", error: "Erro ao criar item" },
    update: { success: "Item atualizado com sucesso!", error: "Erro ao atualizar item" },
    delete: { success: "Item excluído com sucesso!", error: "Erro ao excluir item" },
  });

  return {
    inventario: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addInventario: result.create,
    updateInventario: result.update,
    deleteInventario: result.delete,
  };
}
