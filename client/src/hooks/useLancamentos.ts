import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Lancamento = Tables<"lancamentos">;
export type LancamentoInsert = Omit<TablesInsert<"lancamentos">, "user_id" | "id" | "created_at" | "updated_at">;
export type LancamentoUpdate = Omit<TablesUpdate<"lancamentos">, "id" | "user_id" | "created_at" | "updated_at">;

export type LancamentoWithRelations = Lancamento & {
  artistas?: Tables<"artistas"> | null;
};

export function useLancamentos() {
  const result = useSupabaseQuery<LancamentoWithRelations>({
    queryKey: [...QUERY_KEYS.LANCAMENTOS],
    table: "lancamentos",
    select: "*, artistas(*)",
    orderBy: { column: "data_lancamento", ascending: false },
  }, {
    create: { success: "Lançamento criado com sucesso!", error: "Erro ao criar lançamento" },
    update: { success: "Lançamento atualizado com sucesso!", error: "Erro ao atualizar lançamento" },
    delete: { success: "Lançamento excluído com sucesso!", error: "Erro ao excluir lançamento" },
  });

  return {
    lancamentos: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addLancamento: result.create,
    updateLancamento: result.update,
    deleteLancamento: result.delete,
  };
}
