/**
 * modules/accounting/hooks/useAllTransactions.ts
 *
 * Every transaction of the tenant (optionally of one artist) for aggregate
 * views — P&L totals, FinanceChart, the finance tab of the 360° View. A plain
 * list request inherits the API's default page (limit 50, newest first), so
 * totals silently covered only the 50 most recent rows. This sweeps all pages
 * with fetchAllPages and surfaces `truncated` when the safety ceiling was hit,
 * so the UI can warn instead of showing partial totals as complete.
 *
 * The key lives under QUERY_KEYS.TRANSACTIONS, so transaction mutations and
 * realtime invalidations (prefix match) refresh it too.
 */
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS, getCacheConfig } from "@/shared/lib/query-config";
import { fetchAllPages } from "@/shared/lib/exportAll";
import type { TransactionWithRelations } from "../types/accounting.types";

export interface UseAllTransactionsOptions {
  enabled?: boolean;
  /** Restricts the sweep to one artist (server-side `artist_id` filter). */
  artistId?: string;
}

export const ALL_TRANSACTIONS_SCOPE = "all" as const;

export function allTransactionsQueryKey(artistId?: string): string[] {
  return [...QUERY_KEYS.TRANSACTIONS, ALL_TRANSACTIONS_SCOPE, artistId ? `artist:${artistId}` : "tenant"];
}

export function useAllTransactions({ enabled = true, artistId }: UseAllTransactionsOptions = {}) {
  const queryKey = allTransactionsQueryKey(artistId);
  const cacheConfig = getCacheConfig(queryKey);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      fetchAllPages<TransactionWithRelations>("transactions", {
        filters: artistId ? { artist_id: artistId } : undefined,
        orderBy: { column: "transaction_date", ascending: false },
        signal,
      }),
    enabled,
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
  });

  return {
    transactions: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    /** true when the sweep stopped at the safety ceiling before covering every transaction. */
    truncated: query.data?.truncated ?? false,
    isLoading: query.isLoading,
    /** Only a failure with no loaded sweep: a failed background refetch keeps the loaded totals visible. */
    error: query.data === undefined ? query.error : null,
    refetch: query.refetch,
  };
}

/** PT-BR notice shown next to aggregates computed from a truncated sweep. */
export function truncatedTransactionsNotice(loaded: number, total: number): string {
  const fmt = new Intl.NumberFormat("pt-BR");
  return `Os valores consideram apenas ${fmt.format(loaded)} de ${fmt.format(total)} transações. Refine o período ou os filtros para ver os totais completos.`;
}
