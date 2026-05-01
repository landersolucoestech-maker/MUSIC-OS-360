import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Contrato = Tables<"contratos">;
export type ContratoInsert = Omit<TablesInsert<"contratos">, "user_id">;
export type ContratoUpdate = TablesUpdate<"contratos">;

export type ContratoWithRelations = Contrato & {
  artistas?: Tables<"artistas"> | null;
  clientes?: Tables<"clientes"> | null;
  exclusivo?: boolean;
};

export function useContratos() {
  const result = useSupabaseQuery<ContratoWithRelations>({
    queryKey: [...QUERY_KEYS.CONTRATOS],
    table: "contratos",
    select: "*, artistas(*), clientes(*)",
    additionalInvalidateKeys: [[...QUERY_KEYS.ARTISTAS]],
  }, {
    create: { success: "Contrato criado com sucesso!", error: "Erro ao criar contrato" },
    update: { success: "Contrato atualizado com sucesso!", error: "Erro ao atualizar contrato" },
    delete: { success: "Contrato excluído com sucesso!", error: "Erro ao excluir contrato" },
  });

  return {
    contratos: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addContrato: result.create,
    updateContrato: result.update,
    deleteContrato: result.delete,
  };
}
