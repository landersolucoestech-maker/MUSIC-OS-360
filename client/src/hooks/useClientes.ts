import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Cliente = Tables<"clientes">;
export type ClienteInsert = Omit<TablesInsert<"clientes">, "user_id">;
export type ClienteUpdate = TablesUpdate<"clientes">;

export function useClientes() {
  const result = useSupabaseQuery<Cliente>({
    queryKey: [...QUERY_KEYS.CLIENTES],
    table: "clientes",
  }, {
    create: { success: "Cliente criado com sucesso!", error: "Erro ao criar cliente" },
    update: { success: "Cliente atualizado com sucesso!", error: "Erro ao atualizar cliente" },
    delete: { success: "Cliente excluído com sucesso!", error: "Erro ao excluir cliente" },
  });

  return {
    clientes: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addCliente: result.create,
    updateCliente: result.update,
    deleteCliente: result.delete,
  };
}
