import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Projeto = Tables<"projetos">;
export type ProjetoInsert = Omit<TablesInsert<"projetos">, "user_id" | "id" | "created_at" | "updated_at">;
export type ProjetoUpdate = Omit<TablesUpdate<"projetos">, "id" | "user_id" | "created_at" | "updated_at">;

export type ProjetoObraSummary = Pick<Tables<"obras">, "id" | "titulo" | "status">;

export type ProjetoWithRelations = Projeto & {
  artistas?: Tables<"artistas"> | null;
  obras?: ProjetoObraSummary[] | null;
};

export function useProjetos() {
  const result = useSupabaseQuery<ProjetoWithRelations>({
    queryKey: [...QUERY_KEYS.PROJETOS],
    table: "projetos",
    select: "*, artistas(*), obras(id, titulo, status)",
  }, {
    create: { success: "Projeto criado com sucesso!", error: "Erro ao criar projeto" },
    update: { success: "Projeto atualizado com sucesso!", error: "Erro ao atualizar projeto" },
    delete: { success: "Projeto excluído com sucesso!", error: "Erro ao excluir projeto" },
  });

  return {
    projetos: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addProjeto: result.create,
    updateProjeto: result.update,
    deleteProjeto: result.delete,
  };
}
