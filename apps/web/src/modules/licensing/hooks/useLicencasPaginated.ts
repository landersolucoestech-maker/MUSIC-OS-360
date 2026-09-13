import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { LicencaWithRelations } from "../types/licensing.types";

export interface UseLicencasPaginatedParams {
  /** 0-indexado, mesma convenção de usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  /** Um status ("ativa") ou vários separados por vírgula ("negociacao,proposta") — a aba "Propostas" abrange dois status. */
  status?: string;
  midia?: string;
}

export function useLicencasPaginated({ page, pageSize, search, status, midia }: UseLicencasPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (midia) filters.midia_destino = midia;

  const result = usePaginatedDataQuery<LicencaWithRelations>({
    queryKey: [...QUERY_KEYS.LICENSES],
    table: "licencas",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    licencas: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface LicencaStats {
  total: number;
  byGroup: Record<string, number>;
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

const EMPTY_STATS: LicencaStats = { total: 0, byGroup: {} };

/**
 * Contagem + soma de valor por status, sobre o TENANT INTEIRO — GET
 * /licenses/stats (agregado no banco). Task H: os KPIs e as 3 abas de
 * Licenciamento.tsx não podem mais ser calculados só sobre a página atual.
 */
export function useLicencasStats() {
  const query = useQuery<LicencaStats>({
    queryKey: [...QUERY_KEYS.LICENSES, "stats"],
    queryFn: ({ signal }) => api.get<LicencaStats>("/licenses/stats", { signal }),
    staleTime: 30_000,
  });
  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
