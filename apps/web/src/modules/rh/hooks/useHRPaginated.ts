import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { Employee } from "./useEmployees";
import type { PayrollEntry } from "./usePayroll";
import type { LeaveRequest } from "./useLeaveRequests";

export interface UseEmployeesPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  setor?: string;
  enabled?: boolean;
}

export function useEmployeesPaginated({ page, pageSize, search, status, setor, enabled = true }: UseEmployeesPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (setor) filters.setor = setor;

  const result = usePaginatedDataQuery<Employee>({
    queryKey: [...QUERY_KEYS.EMPLOYEES],
    table: "funcionarios",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    funcionarios: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface EmployeeStats {
  total: number;
  byGroup: Record<string, number>;
}

const EMPTY_EMPLOYEE_STATS: EmployeeStats = { total: 0, byGroup: {} };

/** GET /hr/employees/stats — contagem exata por status, tenant inteiro (Task H). */
export function useEmployeesStats() {
  const query = useQuery<EmployeeStats>({
    queryKey: [...QUERY_KEYS.EMPLOYEES, "stats"],
    queryFn: ({ signal }) => api.get<EmployeeStats>("/hr/employees/stats", { signal }),
    staleTime: 30_000,
  });
  return { stats: query.data ?? EMPTY_EMPLOYEE_STATS, isLoading: query.isLoading, error: query.error };
}

export interface UsePayrollPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  competencia?: string;
  status?: string;
  enabled?: boolean;
}

export function usePayrollPaginated({ page, pageSize, search, competencia, status, enabled = true }: UsePayrollPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (competencia) filters.competencia = competencia;
  if (status) filters.status = status;

  const result = usePaginatedDataQuery<PayrollEntry>({
    queryKey: [...QUERY_KEYS.PAYROLL],
    table: "folha_pagamento",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    folhaPagamento: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface UseLeaveRequestsPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  enabled?: boolean;
}

export function useLeaveRequestsPaginated({ page, pageSize, search, status, enabled = true }: UseLeaveRequestsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;

  const result = usePaginatedDataQuery<LeaveRequest>({
    queryKey: [...QUERY_KEYS.LEAVE_REQUESTS],
    table: "ferias_ausencias",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    feriasAusencias: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
