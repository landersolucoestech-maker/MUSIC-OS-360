import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Licenca = Tables<"licencas">;
export type LicencaInsert = Omit<TablesInsert<"licencas">, "user_id" | "id" | "created_at" | "updated_at">;
export type LicencaUpdate = Omit<TablesUpdate<"licencas">, "id" | "user_id" | "created_at" | "updated_at">;

export type LicencaWithRelations = Licenca & {
  clientes?: Tables<"clientes"> | null;
};

export function useLicencas() {
  const result = useSupabaseQuery<LicencaWithRelations>({
    queryKey: [...QUERY_KEYS.LICENCAS],
    table: "licencas",
    select: "*, clientes(*)",
  }, {
    create: { success: "Licença criada com sucesso!", error: "Erro ao criar licença" },
    update: { success: "Licença atualizada com sucesso!", error: "Erro ao atualizar licença" },
    delete: { success: "Licença excluída com sucesso!", error: "Erro ao excluir licença" },
  });

  return {
    licencas: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addLicenca: result.create,
    updateLicenca: result.update,
    deleteLicenca: result.delete,
  };
}
