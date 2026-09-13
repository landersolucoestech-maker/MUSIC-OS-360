import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { Licenca, LicencaInsert, LicencaUpdate, LicencaWithRelations } from "../types/licensing.types";

export type { Licenca, LicencaInsert, LicencaUpdate, LicencaWithRelations };

export function useLicencas() {
  const result = useDataQuery<LicencaWithRelations>({
    queryKey: [...QUERY_KEYS.LICENSES],
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
    refetch: result.refetch,
    addLicenca: result.create,
    updateLicenca: result.update,
    deleteLicenca: result.delete,
  };
}
