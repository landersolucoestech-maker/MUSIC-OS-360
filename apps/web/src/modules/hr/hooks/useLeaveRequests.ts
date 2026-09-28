import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { LeaveRequest, LeaveRequestInsert, LeaveRequestUpdate } from "../types/hr.types";

export type { LeaveRequest, LeaveRequestInsert, LeaveRequestUpdate };


export function useLeaveRequests() {
  const result = useDataQuery<LeaveRequest>({
    queryKey: [...QUERY_KEYS.LEAVE_REQUESTS],
    table: "leave_requests",
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
