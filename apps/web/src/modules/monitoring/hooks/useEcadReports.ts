import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { EcadReport } from "@/modules/monitoring/rights/types";

export function useEcadReports() {
  const result = useDataQuery<EcadReport>({
    queryKey: [...QUERY_KEYS.ECAD_REPORTS],
    table: "relatorios_ecad",
    orderBy: { column: "created_at", ascending: false },
  }, {
    create: { success: "Relatório ECAD criado com sucesso!", error: "Erro ao criar relatório ECAD" },
    update: { success: "Relatório ECAD atualizado com sucesso!", error: "Erro ao atualizar relatório ECAD" },
    delete: { success: "Relatório ECAD excluído com sucesso!", error: "Erro ao excluir relatório ECAD" },
  });

  return {
    reports: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
