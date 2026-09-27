import { useQuery } from "@tanstack/react-query";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { storage } from "@/shared/lib/storage";

export interface UseEntityLookupParams {
  /** Table/resource name — same key used in TABLE_ENDPOINT (api-client.ts). */
  table: string;
  /** Term typed by the user (not debounced — the hook debounces internally). */
  search: string;
  filters?: Record<string, unknown>;
  pageSize?: number;
  /** Only fetches when true — typically the popover's `open`, avoids firing
   * requests for a combobox that was never opened. */
  enabled?: boolean;
}

/**
 * Task I — reusable server-side lookup for selects/comboboxes/pickers.
 *
 * Replaces the "useArtistas() without a filter → tenant's first 50" pattern with a
 * real search: each keystroke (debounced 300ms) becomes a new query, scoped to the
 * typed term — never the whole table, never a larger fixed limit. Without a
 * search, it shows the most recent (same default as always), but THAT is
 * intentional (browse by recency), not a silent 50 cap for the whole
 * tenant — typing any part of record #75's name brings it back.
 *
 * Reuses usePaginatedDataQuery (queryKey, AbortSignal, keepPreviousData,
 * stale request cancellation) already validated in Task H — it only adds the
 * debounce, which each page there already did individually.
 */
export function useEntityLookup<T extends object>({
  table, search, filters, pageSize = 20, enabled = true,
}: UseEntityLookupParams) {
  const debouncedSearch = useDebounce(search, 300);

  const result = usePaginatedDataQuery<T>({
    queryKey: ["lookup", table],
    table,
    page: 1,
    pageSize,
    search: debouncedSearch || undefined,
    filters,
    enabled,
  });

  return {
    items: result.items,
    total: result.total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    /** Search in flight (debounce not settled yet) — use it for "typing…" UI. */
    isDebouncing: search !== debouncedSearch,
  };
}

/**
 * Resolves ONE record by ID directly (GET /:resource/:id) — never scans
 * a truncated list. Used to: (a) show the label of the value already
 * selected in a combobox before any search, and (b) resolve `?edit=id`
 * without depending on the record being among the first 50 loaded.
 */
export function useEntityById<T extends object>(table: string, id: string | null | undefined) {
  const query = useQuery<T | undefined>({
    queryKey: ["byId", table, id],
    queryFn: () => storage.findById<T & { id: string }>(table, id as string) as Promise<T | undefined>,
    enabled: !!id,
    staleTime: 30_000,
  });
  return { entity: query.data, isLoading: query.isLoading, error: query.error };
}
