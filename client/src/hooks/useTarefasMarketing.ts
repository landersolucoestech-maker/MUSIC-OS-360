import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type TarefaMarketing = Tables<"tarefas_marketing">;
export type TarefaMarketingInsert = Omit<TablesInsert<"tarefas_marketing">, "user_id" | "id" | "created_at" | "updated_at">;
export type TarefaMarketingUpdate = Omit<TablesUpdate<"tarefas_marketing">, "id" | "user_id" | "created_at" | "updated_at">;

export type TarefaMarketingWithRelations = TarefaMarketing & {
  campanhas?: Tables<"campanhas"> | null;
};

export function useTarefasMarketing() {
  const result = useSupabaseQuery<TarefaMarketingWithRelations>({
    queryKey: [...QUERY_KEYS.TAREFAS_MARKETING],
    table: "tarefas_marketing",
    select: "*, campanhas(*)",
  }, {
    create: { success: "Tarefa criada com sucesso!", error: "Erro ao criar tarefa" },
    update: { success: "Tarefa atualizada com sucesso!", error: "Erro ao atualizar tarefa" },
    delete: { success: "Tarefa excluída com sucesso!", error: "Erro ao excluir tarefa" },
  });

  return {
    tarefas: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addTarefa: result.create,
    updateTarefa: result.update,
    deleteTarefa: result.delete,
  };
}
