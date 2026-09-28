import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { Takedown, TakedownInsert, TakedownUpdate } from "../types/monitoring.types";

export type { Takedown, TakedownInsert, TakedownUpdate };

export function useTakedowns() {
  const result = useDataQuery<Takedown>({
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
    refetch: result.refetch,
    addTakedown: result.create,
    updateTakedown: result.update,
    deleteTakedown: result.delete,
  };
}
