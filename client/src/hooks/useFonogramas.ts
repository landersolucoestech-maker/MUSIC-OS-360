import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Fonograma = Tables<"fonogramas">;
export type FonogramaInsert = Omit<TablesInsert<"fonogramas">, "user_id" | "id" | "created_at" | "updated_at">;
export type FonogramaUpdate = Omit<TablesUpdate<"fonogramas">, "id" | "user_id" | "created_at" | "updated_at">;

export type FonogramaWithRelations = Fonograma & {
  artistas?: Tables<"artistas"> | null;
};

export function useFonogramas() {
  const result = useSupabaseQuery<FonogramaWithRelations>({
    queryKey: [...QUERY_KEYS.FONOGRAMAS],
    table: "fonogramas",
    select: "*, artistas(*)",
  }, {
    create: { success: "Fonograma criado com sucesso!", error: "Erro ao criar fonograma" },
    update: { success: "Fonograma atualizado com sucesso!", error: "Erro ao atualizar fonograma" },
    delete: { success: "Fonograma excluído com sucesso!", error: "Erro ao excluir fonograma" },
  });

  return {
    fonogramas: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addFonograma: result.create,
    updateFonograma: result.update,
    deleteFonograma: result.delete,
  };
}
