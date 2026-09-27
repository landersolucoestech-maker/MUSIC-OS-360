import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import { resolveStatusFromRawStatus, type ReleaseStatus } from "@/modules/releases/lib/release-status";
import type { ReleaseWithRelations } from "./useReleases";

export interface UseReleasesPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  type?: string;
  artistId?: string;
}

export function useReleasesPaginated({ page, pageSize, search, status, type, artistId }: UseReleasesPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (type) filters.type = type;
  if (artistId) filters.artistId = artistId;

  const result = usePaginatedDataQuery<ReleaseWithRelations>({
    queryKey: [...QUERY_KEYS.RELEASES],
    table: "lancamentos",
    page: page + 1,
    pageSize,
    search,
    filters,
    orderBy: { column: "data_lancamento", ascending: false },
  });

  return {
    lancamentos: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

interface RawStatusRow {
  status: string;
  has_required: boolean;
  cnt: number;
}

export interface DistributionKPIs {
  total: number;
  distributed: number;
  pending: number;
  waitingAction: number;
}

const EMPTY_DISTRIBUTION_KPIS: DistributionKPIs = { total: 0, distributed: 0, pending: 0, waitingAction: 0 };

/**
 * GET /releases/stats — exact distribution (whole tenant) in the 4 operational
 * buckets the Releases page shows. The backend aggregates only by
 * `status` + "required fields filled"; classification into the 4 buckets
 * uses the SAME function (resolveStatusFromRawStatus) that already classifies each
 * card individually — no business rule duplicated in SQL.
 */
export function useReleasesDistributionStats() {
  const query = useQuery<RawStatusRow[]>({
    queryKey: [...QUERY_KEYS.RELEASES, "stats"],
    queryFn: ({ signal }) => api.get<RawStatusRow[]>("/releases/stats", { signal }),
    staleTime: 30_000,
  });

  const rows = query.data ?? [];
  const kpis: DistributionKPIs = rows.length === 0
    ? EMPTY_DISTRIBUTION_KPIS
    : rows.reduce((acc, row) => {
        const bucket: ReleaseStatus = resolveStatusFromRawStatus(row.status, row.has_required);
        acc.total += row.cnt;
        if (bucket === "distribuido") acc.distributed += row.cnt;
        else if (bucket === "pendente") acc.pending += row.cnt;
        else if (bucket === "em_espera" || bucket === "incompleto" || bucket === "rejeitado" || bucket === "takedown") acc.waitingAction += row.cnt;
        return acc;
      }, { total: 0, distributed: 0, pending: 0, waitingAction: 0 });

  return { kpis, isLoading: query.isLoading, error: query.error };
}
