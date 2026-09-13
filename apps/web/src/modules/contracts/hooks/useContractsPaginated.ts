import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { ContractWithRelations } from "./useContracts";

export interface UseContractsPaginatedParams {
  /** 0-indexado, mesma convenção de usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  type?: string;
  signingPlatform?: string;
}

export function useContractsPaginated({ page, pageSize, search, status, type, signingPlatform }: UseContractsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (type) filters.type = type;
  if (signingPlatform) filters.signing_platform = signingPlatform;

  const result = usePaginatedDataQuery<ContractWithRelations>({
    queryKey: [...QUERY_KEYS.CONTRACTS],
    table: "contracts",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    contracts: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface ContractStats {
  total: number;
  byGroup: Record<string, number>;
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

const EMPTY_STATS: ContractStats = { total: 0, byGroup: {} };

/**
 * Contagem + soma de valor por status, sobre o TENANT INTEIRO — GET
 * /contracts/stats (agregado no banco). Task H: os KPIs de Contracts.tsx
 * não podem mais ser calculados só sobre a página atual.
 */
export function useContractsStats() {
  const query = useQuery<ContractStats>({
    queryKey: [...QUERY_KEYS.CONTRACTS, "stats"],
    queryFn: ({ signal }) => api.get<ContractStats>("/contracts/stats", { signal }),
    staleTime: 30_000,
  });
  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
