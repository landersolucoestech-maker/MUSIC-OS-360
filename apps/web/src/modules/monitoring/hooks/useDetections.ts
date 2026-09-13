import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { ContentDetection } from "@/modules/monitoring/rights/types";

export function useDetections() {
  const result = useDataQuery<ContentDetection>({
    queryKey: [...QUERY_KEYS.CONTENT_DETECTIONS],
    table: "deteccoes",
    orderBy: { column: "detectado_em", ascending: false },
  }, {
    create: { success: "Detecção registrada com sucesso!", error: "Erro ao registrar detecção" },
    update: { success: "Detecção atualizada com sucesso!", error: "Erro ao atualizar detecção" },
    delete: { success: "Detecção excluída com sucesso!", error: "Erro ao excluir detecção" },
  });

  return {
    detections: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addDetection: result.create,
    updateDetection: result.update,
    deleteDetection: result.delete,
  };
}
