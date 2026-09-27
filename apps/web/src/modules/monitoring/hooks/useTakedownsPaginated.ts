import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { TakedownWithRelations } from "../types/monitoring.types";

export interface UseTakedownsPaginatedParams {
  /** 0-indexed, same convention as usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  plataforma?: string;
}

export function useTakedownsPaginated({ page, pageSize, search, status, plataforma: platform }: UseTakedownsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (platform) filters.plataforma = platform;

  const result = usePaginatedDataQuery<TakedownWithRelations>({
    queryKey: [...QUERY_KEYS.TAKEDOWNS],
    table: "takedowns",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    takedowns: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface TakedownStats {
  total: number;
  byGroup: Record<string, number>;
}

const EMPTY_STATS: TakedownStats = { total: 0, byGroup: {} };

/**
 * Count per status, over the WHOLE TENANT — GET /takedowns/stats
 * (aggregated in the database). Task H: the Takedowns.tsx KPIs can no longer be
 * computed only over the current page.
 */
export function useTakedownsStats() {
  const query = useQuery<TakedownStats>({
    queryKey: [...QUERY_KEYS.TAKEDOWNS, "stats"],
    queryFn: ({ signal }) => api.get<TakedownStats>("/takedowns/stats", { signal }),
    staleTime: 30_000,
  });
  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
