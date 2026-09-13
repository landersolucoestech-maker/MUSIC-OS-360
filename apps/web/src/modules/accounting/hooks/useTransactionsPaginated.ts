import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { Transaction } from "./useTransactions";

export interface UseTransactionsPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  type?: string;
  status?: string;
  categoria?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useTransactionsPaginated({
  page, pageSize, search, type, status, categoria, dateFrom, dateTo,
}: UseTransactionsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (type) filters.type = type;
  if (status) filters.status = status;
  if (categoria) filters.categoria = categoria;
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
  type: string;
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
 * GET /transactions/stats — distribuição exata type×status + soma de valor,
 * tenant inteiro (Task H). Os KPIs de Financeiro.tsx nunca são calculados só
 * sobre a página ou o intervalo de datas atualmente filtrado na tabela.
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
    if (row.type === "receita" && row.status === "paid") { revenuePaid += row.sum; }
    else if (row.type === "despesa" && row.status === "paid") { expensesPaid += row.sum; }
    else if (row.type === "receita" && row.status === "pending") { receivables += row.sum; pendingRevenue += row.cnt; }
    else if (row.type === "despesa" && row.status === "pending") { payables += row.sum; pendingExpenses += row.cnt; }
  }
  const netProfit = revenuePaid - expensesPaid;
  const margin = revenuePaid > 0 ? Math.round((netProfit / revenuePaid) * 100) : 0;

  const kpis: FinanceKPIs = rows.length === 0 ? EMPTY_KPIS : {
    total, revenuePaid, expensesPaid, netProfit, receivables, payables,
    margin, pendingRevenue, pendingExpenses,
  };

  return { kpis, isLoading: query.isLoading, error: query.error };
}
