import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type FolhaPagamento = Tables<"folha_pagamento">;
export type FolhaPagamentoInsert = Omit<TablesInsert<"folha_pagamento">, "user_id">;
export type FolhaPagamentoUpdate = TablesUpdate<"folha_pagamento">;

export const STATUS_PAGAMENTO = [
  "pendente",
  "pago",
  "cancelado",
] as const;

export function useFolhaPagamento() {
  const result = useSupabaseQuery<FolhaPagamento>({
    queryKey: [...QUERY_KEYS.FOLHA_PAGAMENTO],
    table: "folha_pagamento",
  }, {
    create: { success: "Registro de pagamento criado com sucesso!", error: "Erro ao criar registro de pagamento" },
    update: { success: "Registro de pagamento atualizado com sucesso!", error: "Erro ao atualizar registro de pagamento" },
    delete: { success: "Registro de pagamento excluído com sucesso!", error: "Erro ao excluir registro de pagamento" },
  });

  return {
    folhaPagamento: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addFolhaPagamento: result.create,
    updateFolhaPagamento: result.update,
    deleteFolhaPagamento: result.delete,
  };
}
