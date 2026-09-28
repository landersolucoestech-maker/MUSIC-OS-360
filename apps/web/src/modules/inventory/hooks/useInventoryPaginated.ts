import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { InventoryItem } from "../types/inventory.types";

export interface UseInventoryPaginatedParams {
  /** 0-indexed, same convention as usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  category?: string;
  storageLocation?: string;
}

export function useInventoryPaginated({ page, pageSize, search, status, category, storageLocation }: UseInventoryPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (category) filters.category = category;
  if (storageLocation) filters.storage_location = storageLocation;

  const result = usePaginatedDataQuery<InventoryItem>({
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

export interface InventoryStats {
  total: number;
  byGroup: Record<string, number>;
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

const EMPTY_STATS: InventoryStats = { total: 0, byGroup: {} };

/**
 * Count per status + asset value sum, over the WHOLE TENANT —
 * GET /inventory/stats (aggregated in the database). Task H: the
 * Inventory.tsx KPIs can no longer be computed over the current page only.
 */
export function useInventoryStats() {
  const query = useQuery<InventoryStats>({
    queryKey: [...QUERY_KEYS.INVENTORY, "stats"],
    queryFn: ({ signal }) => api.get<InventoryStats>("/inventory/stats", { signal }),
    staleTime: 30_000,
  });
  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
