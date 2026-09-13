import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { PayrollEntry, PayrollEntryInsert, PayrollEntryUpdate } from "../types/hr.types";

export type { PayrollEntry, PayrollEntryInsert, PayrollEntryUpdate };

export const PAYMENT_STATUS = [
  "pending",
  "paid",
  "cancelled",
] as const;

export function usePayroll() {
  const result = useDataQuery<PayrollEntry>({
    queryKey: [...QUERY_KEYS.PAYROLL],
    table: "folha_pagamento",
  }, {
    create: { success: "Registro de pagamento criado com sucesso!", error: "Erro ao criar registro de pagamento" },
    update: { success: "Registro de pagamento atualizado com sucesso!", error: "Erro ao atualizar registro de pagamento" },
    delete: { success: "Registro de pagamento excluído com sucesso!", error: "Erro ao excluir registro de pagamento" },
  });

  return {
    payrollEntries: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addPayrollEntry: result.create,
    updatePayrollEntry: result.update,
    deletePayrollEntry: result.delete,
  };
}
