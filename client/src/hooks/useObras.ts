import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Obra = Tables<"obras">;
export type ObraInsert = Omit<TablesInsert<"obras">, "user_id" | "id" | "created_at" | "updated_at">;
export type ObraUpdate = Omit<TablesUpdate<"obras">, "id" | "user_id" | "created_at" | "updated_at">;

export type ObraWithRelations = Obra & {
  artistas?: Tables<"artistas"> | null;
  projetos?: Pick<Tables<"projetos">, "id" | "titulo"> | null;
};

export function useObras() {
  const result = useSupabaseQuery<ObraWithRelations>({
    queryKey: [...QUERY_KEYS.OBRAS],
    table: "obras",
    select: "*, artistas(*), projetos(id, titulo)",
    additionalInvalidateKeys: [[...QUERY_KEYS.PROJETOS]],
  }, {
    create: { success: "Obra criada com sucesso!", error: "Erro ao criar obra" },
    update: { success: "Obra atualizada com sucesso!", error: "Erro ao atualizar obra" },
    delete: { success: "Obra excluída com sucesso!", error: "Erro ao excluir obra" },
  });

  return {
    obras: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addObra: result.create,
    updateObra: result.update,
    deleteObra: result.delete,
  };
}
