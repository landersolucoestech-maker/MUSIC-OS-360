import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Takedown = Tables<"takedowns">;
export type TakedownInsert = Omit<TablesInsert<"takedowns">, "user_id" | "id" | "created_at" | "updated_at">;
export type TakedownUpdate = Omit<TablesUpdate<"takedowns">, "id" | "user_id" | "created_at" | "updated_at">;

export type TakedownWithRelations = Takedown & {
  obras?: Tables<"obras"> | null;
  fonogramas?: Tables<"fonogramas"> | null;
};

export function useTakedowns() {
  const result = useSupabaseQuery<TakedownWithRelations>({
    queryKey: [...QUERY_KEYS.TAKEDOWNS],
    table: "takedowns",
    select: "*, obras(*), fonogramas(*)",
  }, {
    create: { success: "Takedown criado com sucesso!", error: "Erro ao criar takedown" },
    update: { success: "Takedown atualizado com sucesso!", error: "Erro ao atualizar takedown" },
    delete: { success: "Takedown excluído com sucesso!", error: "Erro ao excluir takedown" },
  });

  return {
    takedowns: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addTakedown: result.create,
    updateTakedown: result.update,
    deleteTakedown: result.delete,
  };
}
