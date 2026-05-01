import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Briefing = Tables<"briefings">;
export type BriefingInsert = Omit<TablesInsert<"briefings">, "user_id">;
export type BriefingUpdate = TablesUpdate<"briefings">;

export type BriefingWithRelations = Briefing & {
  campanhas?: Tables<"campanhas"> | null;
  artistas?: Tables<"artistas"> | null;
};

export function useBriefings() {
  const result = useSupabaseQuery<BriefingWithRelations>({
    queryKey: [...QUERY_KEYS.BRIEFINGS],
    table: "briefings",
    select: "*, campanhas(*), artistas(*)",
  }, {
    create: { success: "Briefing criado com sucesso!", error: "Erro ao criar briefing" },
    update: { success: "Briefing atualizado com sucesso!", error: "Erro ao atualizar briefing" },
    delete: { success: "Briefing excluído com sucesso!", error: "Erro ao excluir briefing" },
  });

  return {
    briefings: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addBriefing: result.create,
    updateBriefing: result.update,
    deleteBriefing: result.delete,
  };
}
