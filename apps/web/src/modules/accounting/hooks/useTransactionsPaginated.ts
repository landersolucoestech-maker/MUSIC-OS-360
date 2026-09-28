import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { Transaction } from "./useTransactions";
import type { TransactionType } from "../types/accounting.types";

export interface UseTransactionsPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  type?: string;
  status?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useTransactionsPaginated({
  page, pageSize, search, type, status, category, dateFrom, dateTo,
}: UseTransactionsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (type) filters.type = type;
  if (status) filters.status = status;
  if (category) filters.category = category;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  const result = usePaginatedDataQuery<Transaction>({
    queryKey: [...QUERY_KEYS.TRANSACTIONS],
    table: "transactions",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    transactions: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

interface TypeStatusRow {
  type: TransactionType;
  status: string;
  cnt: number;
  sum: number;
}

export interface FinanceKPIs {
  total: number;
  revenuePaid: number;
  expensesPaid: number;
  netProfit: number;
  receivables: number;
  payables: number;
  margin: number;
  pendingRevenue: number;
  pendingExpenses: number;
}

const EMPTY_KPIS: FinanceKPIs = {
  total: 0, revenuePaid: 0, expensesPaid: 0, netProfit: 0, receivables: 0,
  payables: 0, margin: 0, pendingRevenue: 0, pendingExpenses: 0,
};

/**
 * GET /transactions/stats — exact type×status distribution + value sum,
 * whole tenant (Task H). The KPIs of Financeiro.tsx are never computed only
 * over the page or the date range currently filtered in the table.
 */
export function useFinanceStats() {
  const query = useQuery<TypeStatusRow[]>({
    queryKey: [...QUERY_KEYS.TRANSACTIONS, "stats"],
    queryFn: ({ signal }) => api.get<TypeStatusRow[]>("/transactions/stats", { signal }),
    staleTime: 30_000,
  });

  const rows = query.data ?? [];
  let total = 0, revenuePaid = 0, expensesPaid = 0, receivables = 0, payables = 0;
  let pendingRevenue = 0, pendingExpenses = 0;
  for (const row of rows) {
    total += row.cnt;
    if (row.type === "revenue" && row.status === "paid") { revenuePaid += row.sum; }
    else if (row.type === "expense" && row.status === "paid") { expensesPaid += row.sum; }
    else if (row.type === "revenue" && row.status === "pending") { receivables += row.sum; pendingRevenue += row.cnt; }
    else if (row.type === "expense" && row.status === "pending") { payables += row.sum; pendingExpenses += row.cnt; }
  }
  const netProfit = revenuePaid - expensesPaid;
  const margin = revenuePaid > 0 ? Math.round((netProfit / revenuePaid) * 100) : 0;

  const kpis: FinanceKPIs = rows.length === 0 ? EMPTY_KPIS : {
    total, revenuePaid, expensesPaid, netProfit, receivables, payables,
    margin, pendingRevenue, pendingExpenses,
  };

  return { kpis, isLoading: query.isLoading, error: query.error };
}
