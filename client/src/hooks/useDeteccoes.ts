import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Deteccao = Tables<"deteccoes">;
export type DeteccaoInsert = Omit<TablesInsert<"deteccoes">, "user_id">;
export type DeteccaoUpdate = TablesUpdate<"deteccoes">;

export type DeteccaoWithRelations = Deteccao & {
  obras?: Tables<"obras"> | null;
};

export function useDeteccoes() {
  const result = useSupabaseQuery<DeteccaoWithRelations>({
    queryKey: [...QUERY_KEYS.DETECCOES],
    table: "deteccoes",
    select: "*, obras(*)",
  }, {
    create: { success: "Detecção registrada com sucesso!", error: "Erro ao registrar detecção" },
    update: { success: "Detecção atualizada com sucesso!", error: "Erro ao atualizar detecção" },
    delete: { success: "Detecção excluída com sucesso!", error: "Erro ao excluir detecção" },
  });

  return {
    deteccoes: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addDeteccao: result.create,
    updateDeteccao: result.update,
    deleteDeteccao: result.delete,
  };
}
