import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { LicenseWithRelations } from "../types/licensing.types";

export interface UseLicensesPaginatedParams {
  /** 0-indexed, same convention as usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  /** One status ("ativa") or several separated by commas ("negociacao,proposta") — the "Propostas" tab spans two statuses. */
  status?: string;
  midia?: string;
}

export function useLicensesPaginated({ page, pageSize, search, status, midia: media }: UseLicensesPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (media) filters.midia_destino = media;

  const result = usePaginatedDataQuery<LicenseWithRelations>({
    queryKey: [...QUERY_KEYS.LICENSES],
    table: "licencas",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    licenses: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface LicenseStats {
  total: number;
  byGroup: Record<string, number>;
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

const EMPTY_STATS: LicenseStats = { total: 0, byGroup: {} };

/**
 * Count + value sum per status, over the WHOLE TENANT — GET
 * /licenses/stats (aggregated in the database). Task H: the KPIs and the 3 tabs of
 * Licenciamento.tsx can no longer be computed over the current page only.
 */
export function useLicensesStats() {
  const query = useQuery<LicenseStats>({
    queryKey: [...QUERY_KEYS.LICENSES, "stats"],
    queryFn: ({ signal }) => api.get<LicenseStats>("/licenses/stats", { signal }),
    staleTime: 30_000,
  });
  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
