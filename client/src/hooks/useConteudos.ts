import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Conteudo = Tables<"conteudos">;
export type ConteudoInsert = Omit<TablesInsert<"conteudos">, "user_id" | "id" | "created_at" | "updated_at">;
export type ConteudoUpdate = Omit<TablesUpdate<"conteudos">, "id" | "user_id" | "created_at" | "updated_at">;

export type ConteudoWithRelations = Conteudo & {
  lancamentos?: (Tables<"lancamentos"> & {
    artistas?: Tables<"artistas"> | null;
  }) | null;
};

export function useConteudos() {
  const result = useSupabaseQuery<ConteudoWithRelations>({
    queryKey: [...QUERY_KEYS.CONTEUDOS],
    table: "conteudos",
    select: "*, lancamentos(*, artistas(*))",
    orderBy: { column: "created_at", ascending: false },
  }, {
    create: { success: "Conteúdo criado com sucesso!", error: "Erro ao criar conteúdo" },
    update: { success: "Conteúdo atualizado com sucesso!", error: "Erro ao atualizar conteúdo" },
    delete: { success: "Conteúdo excluído com sucesso!", error: "Erro ao excluir conteúdo" },
  });

  return {
    conteudos: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addConteudo: result.create,
    updateConteudo: result.update,
    deleteConteudo: result.delete,
  };
}
