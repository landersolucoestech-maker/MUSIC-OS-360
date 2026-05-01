import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type NotaFiscal = Tables<"notas_fiscais">;
export type NotaFiscalInsert = Omit<TablesInsert<"notas_fiscais">, "user_id" | "id" | "created_at" | "updated_at">;
export type NotaFiscalUpdate = Omit<TablesUpdate<"notas_fiscais">, "id" | "user_id" | "created_at" | "updated_at">;

export type NotaFiscalWithRelations = NotaFiscal & {
  clientes?: Tables<"clientes"> | null;
  vendas?: Tables<"vendas"> | null;
};

export function useNotasFiscais() {
  const result = useSupabaseQuery<NotaFiscalWithRelations>({
    queryKey: [...QUERY_KEYS.NOTAS_FISCAIS],
    table: "notas_fiscais",
    select: "*, clientes(*), vendas(*)",
  }, {
    create: { success: "Nota fiscal criada com sucesso!", error: "Erro ao criar nota fiscal" },
    update: { success: "Nota fiscal atualizada com sucesso!", error: "Erro ao atualizar nota fiscal" },
    delete: { success: "Nota fiscal excluída com sucesso!", error: "Erro ao excluir nota fiscal" },
  });

  return {
    notasFiscais: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addNotaFiscal: result.create,
    updateNotaFiscal: result.update,
    deleteNotaFiscal: result.delete,
  };
}
