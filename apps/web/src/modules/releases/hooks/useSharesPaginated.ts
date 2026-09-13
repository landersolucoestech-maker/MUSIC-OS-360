import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { ShareWithRelations } from "./useShares";

export interface UseSharesPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  direction?: string;
  status?: string;
  type?: string;
  shareType?: string;
}

export function useSharesPaginated({ page, pageSize, search, direction, status, type, shareType }: UseSharesPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (direction) filters.direction = direction;
  if (status) filters.status = status;
  if (type) filters.type = type;
  if (shareType) filters.share_type = shareType;

  const result = usePaginatedDataQuery<ShareWithRelations>({
    queryKey: [...QUERY_KEYS.SHARES],
    table: "shares",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    shares: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

interface DirecaoStatusRow {
  direction: string | null;
  status: string;
  cnt: number;
}

export interface ShareKPIs {
  aReceber: number;
  recebidos: number;
  aEnviar: number;
  enviados: number;
}

const EMPTY_SHARE_KPIS: ShareKPIs = { aReceber: 0, recebidos: 0, aEnviar: 0, enviados: 0 };

/** GET /shares/stats — distribuição exata direção×status, tenant inteiro (Task H). */
export function useSharesStats() {
  const query = useQuery<DirecaoStatusRow[]>({
    queryKey: [...QUERY_KEYS.SHARES, "stats"],
    queryFn: ({ signal }) => api.get<DirecaoStatusRow[]>("/shares/stats", { signal }),
    staleTime: 30_000,
  });

  const rows = query.data ?? [];
  const kpis = rows.length === 0 ? EMPTY_SHARE_KPIS : rows.reduce((acc, row) => {
    const pendingLike = row.status === "pendente" || row.status === "parcial";
    if (row.direction === "a_receber" && pendingLike) acc.aReceber += row.cnt;
    else if (row.direction === "a_receber" && row.status === "recebido") acc.recebidos += row.cnt;
    else if (row.direction === "a_enviar" && pendingLike) acc.aEnviar += row.cnt;
    else if (row.direction === "a_enviar" && row.status === "enviado") acc.enviados += row.cnt;
    return acc;
  }, { aReceber: 0, recebidos: 0, aEnviar: 0, enviados: 0 });

  return { kpis, isLoading: query.isLoading, error: query.error };
}
