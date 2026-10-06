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
  department?: string;
  enabled?: boolean;
}

export function useEmployeesPaginated({ page, pageSize, search, status, department: department, enabled = true }: UseEmployeesPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (department) filters.department = department;

  const result = usePaginatedDataQuery<Employee>({
    queryKey: [...QUERY_KEYS.EMPLOYEES],
    table: "employees",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    employees: result.items,
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

/** GET /hr/employees/stats — exact count per status, whole tenant (Task H). */
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
  referenceMonth?: string;
  status?: string;
  enabled?: boolean;
}

export function usePayrollPaginated({ page, pageSize, search, referenceMonth, status, enabled = true }: UsePayrollPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (referenceMonth) filters.reference_month = referenceMonth;
  if (status) filters.status = status;

  const result = usePaginatedDataQuery<PayrollEntry>({
    queryKey: [...QUERY_KEYS.PAYROLL],
    table: "payroll_entries",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    payrollEntries: result.items,
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
    table: "leave_requests",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    leaveRequests: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
