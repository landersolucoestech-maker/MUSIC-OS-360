import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { InventarioItem } from "../types/inventory.types";

export interface UseInventarioPaginatedParams {
  /** 0-indexado, mesma convenção de usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  categoria?: string;
  localizacao?: string;
}

export function useInventarioPaginated({ page, pageSize, search, status, categoria, localizacao }: UseInventarioPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (categoria) filters.categoria = categoria;
  if (localizacao) filters.localizacao = localizacao;

  const result = usePaginatedDataQuery<InventarioItem>({
    queryKey: [...QUERY_KEYS.INVENTORY],
    table: "inventario",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    inventario: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface InventarioStats {
  total: number;
  byGroup: Record<string, number>;
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

const EMPTY_STATS: InventarioStats = { total: 0, byGroup: {} };

/**
 * Contagem por status + soma de valor patrimonial, sobre o TENANT INTEIRO —
 * GET /inventory/stats (agregado no banco). Task H: os KPIs de
 * Inventario.tsx não podem mais ser calculados só sobre a página atual.
 */
export function useInventarioStats() {
  const query = useQuery<InventarioStats>({
    queryKey: [...QUERY_KEYS.INVENTORY, "stats"],
    queryFn: ({ signal }) => api.get<InventarioStats>("/inventory/stats", { signal }),
    staleTime: 30_000,
  });
  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
