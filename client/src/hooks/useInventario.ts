import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type InventarioItem = Tables<"inventario">;
export type InventarioInsert = Omit<TablesInsert<"inventario">, "user_id" | "id" | "created_at" | "updated_at">;
export type InventarioUpdate = Omit<TablesUpdate<"inventario">, "id" | "user_id" | "created_at" | "updated_at">;

export function useInventario() {
  const result = useSupabaseQuery<InventarioItem>({
    queryKey: [...QUERY_KEYS.INVENTARIO],
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
    addInventario: result.create,
    updateInventario: result.update,
    deleteInventario: result.delete,
  };
}
