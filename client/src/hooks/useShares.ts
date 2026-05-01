import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Share = Tables<"shares">;
export type ShareInsert = Omit<TablesInsert<"shares">, "user_id" | "id" | "created_at" | "updated_at">;
export type ShareUpdate = Omit<TablesUpdate<"shares">, "id" | "user_id" | "created_at" | "updated_at">;

export type ShareWithRelations = Share & {
  artistas?: Tables<"artistas"> | null;
  obras?: Tables<"obras"> | null;
};

export function useShares() {
  const result = useSupabaseQuery<ShareWithRelations>({
    queryKey: [...QUERY_KEYS.SHARES],
    table: "shares",
    select: "*, obras(*), artistas(*)",
  }, {
    create: { success: "Share criado com sucesso!", error: "Erro ao criar share" },
    update: { success: "Share atualizado com sucesso!", error: "Erro ao atualizar share" },
    delete: { success: "Share excluído com sucesso!", error: "Erro ao excluir share" },
  });

  return {
    shares: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addShare: result.create,
    updateShare: result.update,
    deleteShare: result.delete,
  };
}
