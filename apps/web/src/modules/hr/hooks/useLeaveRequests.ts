import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { LeaveRequest, LeaveRequestInsert, LeaveRequestUpdate } from "../types/hr.types";

export type { LeaveRequest, LeaveRequestInsert, LeaveRequestUpdate };

export const LEAVE_TYPES = [
  "férias",
  "licença médica",
  "licença maternidade",
  "licença paternidade",
  "falta justificada",
  "falta injustificada",
  "day off",
  "folga compensatória",
] as const;

export const LEAVE_STATUS = [
  "pending",
  "approved",
  "rejected",
  "em andamento",
  "completed",
] as const;

export function useLeaveRequests() {
  const result = useDataQuery<LeaveRequest>({
    queryKey: [...QUERY_KEYS.LEAVE_REQUESTS],
    table: "ferias_ausencias",
  }, {
    create: { success: "Registro de ausência criado com sucesso!", error: "Erro ao criar registro de ausência" },
    update: { success: "Registro de ausência atualizado com sucesso!", error: "Erro ao atualizar registro de ausência" },
    delete: { success: "Registro de ausência excluído com sucesso!", error: "Erro ao excluir registro de ausência" },
  });

  return {
    leaveRequests: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addLeaveRequest: result.create,
    updateLeaveRequest: result.update,
    deleteLeaveRequest: result.delete,
  };
}
