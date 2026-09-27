import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { Employee, EmployeeInsert, EmployeeUpdate } from "../types/hr.types";

export type { Employee, EmployeeInsert, EmployeeUpdate };

export const DEPARTMENTS = [
  "Administrativo",
  "Financeiro",
  "Marketing",
  "Jurídico",
  "Produção Musical",
  "A&R",
  "TI",
  "RH",
  "Comercial",
  "Operações",
] as const;

export const CONTRACT_TYPES = [
  "CLT",
  "PJ",
  "Freelancer",
  "Estágio",
  "Temporário",
] as const;

export const EMPLOYEE_STATUS = [
  "active",
  "inactive",
  "on_vacation",
  "on_leave",
  "terminated",
] as const;

export function useEmployees() {
  const result = useDataQuery<Employee>({
    queryKey: [...QUERY_KEYS.EMPLOYEES],
    table: "funcionarios",
  }, {
    create: { success: "Funcionário criado com sucesso!", error: "Erro ao criar funcionário" },
    update: { success: "Funcionário atualizado com sucesso!", error: "Erro ao atualizar funcionário" },
    delete: { success: "Funcionário excluído com sucesso!", error: "Erro ao excluir funcionário" },
  });

  return {
    employees: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addEmployee: result.create,
    updateEmployee: result.update,
    deleteEmployee: result.delete,
  };
}
