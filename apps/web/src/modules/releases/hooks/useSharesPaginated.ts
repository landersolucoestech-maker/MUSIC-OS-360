import { ShareStatus } from "@music-os-360/types";
import { isPendingShareStatus } from "@/modules/releases/lib/share-format";
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
  /** Participant role (author/performer/producer/...) -- filters
   * shares.party_role, not shares.type (ghost column with no real writer;
   * see naming-closure Phase 3). */
  partyRole?: string;
  shareType?: string;
}

export function useSharesPaginated({ page, pageSize, search, direction, status, partyRole, shareType }: UseSharesPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (direction) filters.direction = direction;
  if (status) filters.status = status;
  if (partyRole) filters.party_role = partyRole;
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
  toReceive: number;
  received: number;
  toSend: number;
  sent: number;
}

const EMPTY_SHARE_KPIS: ShareKPIs = { toReceive: 0, received: 0, toSend: 0, sent: 0 };

/** GET /shares/stats — exact direction×status distribution, whole tenant (Task H). */
export function useSharesStats() {
  const query = useQuery<DirecaoStatusRow[]>({
    queryKey: [...QUERY_KEYS.SHARES, "stats"],
    queryFn: ({ signal }) => api.get<DirecaoStatusRow[]>("/shares/stats", { signal }),
    staleTime: 30_000,
  });

  const rows = query.data ?? [];
  const kpis = rows.length === 0 ? EMPTY_SHARE_KPIS : rows.reduce((acc, row) => {
    const pendingLike = isPendingShareStatus(row.status);
    if (row.direction === "receivable" && pendingLike) acc.toReceive += row.cnt;
    else if (row.direction === "receivable" && row.status === ShareStatus.RECEIVED) acc.received += row.cnt;
    else if (row.direction === "payable" && pendingLike) acc.toSend += row.cnt;
    else if (row.direction === "payable" && row.status === ShareStatus.SENT) acc.sent += row.cnt;
    return acc;
  }, { toReceive: 0, received: 0, toSend: 0, sent: 0 });

  return { kpis, isLoading: query.isLoading, error: query.error };
}
