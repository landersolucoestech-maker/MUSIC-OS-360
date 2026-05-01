import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Campanha = Tables<"campanhas">;
export type CampanhaInsert = Omit<TablesInsert<"campanhas">, "user_id">;
export type CampanhaUpdate = TablesUpdate<"campanhas">;

export type CampanhaWithRelations = Campanha & {
  artistas?: Tables<"artistas"> | null;
};

export function useCampanhas() {
  const result = useSupabaseQuery<CampanhaWithRelations>({
    queryKey: [...QUERY_KEYS.CAMPANHAS],
    table: "campanhas",
    select: "*, artistas(*)",
  }, {
    create: { success: "Campanha criada com sucesso!", error: "Erro ao criar campanha" },
    update: { success: "Campanha atualizada com sucesso!", error: "Erro ao atualizar campanha" },
    delete: { success: "Campanha excluída com sucesso!", error: "Erro ao excluir campanha" },
  });

  return {
    campanhas: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addCampanha: result.create,
    updateCampanha: result.update,
    deleteCampanha: result.delete,
  };
}
