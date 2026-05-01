import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type RelatorioECAD = Tables<"relatorios_ecad">;
export type RelatorioECADInsert = Omit<TablesInsert<"relatorios_ecad">, "user_id" | "id" | "created_at" | "updated_at">;
export type RelatorioECADUpdate = Omit<TablesUpdate<"relatorios_ecad">, "id" | "user_id" | "created_at" | "updated_at">;

export function useRelatoriosECAD() {
  const result = useSupabaseQuery<RelatorioECAD>({
    queryKey: [...QUERY_KEYS.RELATORIOS_ECAD],
    table: "relatorios_ecad",
  }, {
    create: { success: "Relatório criado com sucesso!", error: "Erro ao criar relatório" },
    update: { success: "Relatório atualizado com sucesso!", error: "Erro ao atualizar relatório" },
    delete: { success: "Relatório excluído com sucesso!", error: "Erro ao excluir relatório" },
  });

  return {
    relatorios: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addRelatorio: result.create,
    updateRelatorio: result.update,
    deleteRelatorio: result.delete,
  };
}
