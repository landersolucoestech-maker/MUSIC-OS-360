import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Transacao = Tables<"transacoes">;
export type TransacaoInsert = Omit<TablesInsert<"transacoes">, "user_id" | "id" | "created_at">;
export type TransacaoUpdate = Omit<TablesUpdate<"transacoes">, "id" | "user_id" | "created_at">;

export type TransacaoWithRelations = Transacao & {
  artistas?: Tables<"artistas"> | null;
  clientes?: Tables<"clientes"> | null;
  vendas?: Tables<"vendas"> | null;
};

export function useTransacoes() {
  const result = useSupabaseQuery<TransacaoWithRelations>({
    queryKey: [...QUERY_KEYS.TRANSACOES],
    table: "transacoes",
    select: "*, clientes(*), artistas(*), vendas(*)",
    orderBy: { column: "data", ascending: false },
  }, {
    create: { success: "Transação criada com sucesso!", error: "Erro ao criar transação" },
    update: { success: "Transação atualizada com sucesso!", error: "Erro ao atualizar transação" },
    delete: { success: "Transação excluída com sucesso!", error: "Erro ao excluir transação" },
  });

  return {
    transacoes: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addTransacao: result.create,
    updateTransacao: result.update,
    deleteTransacao: result.delete,
  };
}
