import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { License, LicenseInsert, LicenseUpdate } from "../types/licensing.types";

export type { License, LicenseInsert, LicenseUpdate };

export function useLicenses() {
  const result = useDataQuery<License>({
    queryKey: [...QUERY_KEYS.LICENSES],
    table: "licenses",
    select: "*, clientes(*)",
  }, {
    create: { success: "Licença criada com sucesso!", error: "Erro ao criar licença" },
    update: { success: "Licença atualizada com sucesso!", error: "Erro ao atualizar licença" },
    delete: { success: "Licença excluída com sucesso!", error: "Erro ao excluir licença" },
  });

  return {
    licenses: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addLicense: result.create,
    updateLicense: result.update,
    deleteLicense: result.delete,
  };
}
