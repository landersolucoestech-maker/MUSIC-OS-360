import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCacheConfig } from "@/shared/lib/query-config";
import { storage, type PagedResult } from "@/shared/lib/storage";

import { toUserMessage } from "@/shared/lib/errors";
/**
 * Real server-side pagination (Task G) — companion of useDataQuery.ts.
 *
 * useDataQuery() fetches the whole table (with a fixed limit/offset passed
 * by the caller, typically none → backend default of 50 records) and is
 * right for "give me everything" (selects, cross-reference, dropdowns). For a
 * user-visible paginated TABLE, that is the problem described in Task G:
 * either it silently stops at 50 records, or — if someone raised the
 * limit — it would download tens of thousands of rows just to show 20.
 *
 * This hook fetches ONLY the current page: page/pageSize/search/filters/sort
 * go into the queryKey (different pages = different cache, without mixing
 * results) and become real query params (?limit=&offset=&search=&orderBy=),
 * using the same endpoints already paginated in the backend (see PaginationDto /
 * QueryArtistDto etc.) — no new endpoint was needed for the
 * resources already migrated.
 */

type MutationSuccessCallbacks<T> = {
  onCreate?: (result: T) => void;
  onUpdate?: (result: T) => void;
  onDelete?: (id: string) => void;
};

export type PaginatedQueryConfig<T = object> = {
  /** Stable queryKey prefix — page/pageSize/search/filters/sort are appended automatically. */
  queryKey: string[];
  table: string;
  page: number;
  pageSize: number;
  search?: string;
  /** Name of the backend search query param (e.g. "search", "q"). Default: "search". */
  searchParam?: string;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
  additionalInvalidateKeys?: string[][];
  onMutationSuccess?: MutationSuccessCallbacks<T>;
  _phantom?: T;
};

type MutationMessages = {
  create?: { success: string; error: string };
  update?: { success: string; error: string };
  delete?: { success: string; error: string };
};

const defaultMessages: MutationMessages = {
  create: { success: "Criado com sucesso!", error: "Erro ao criar" },
  update: { success: "Atualizado com sucesso!", error: "Erro ao atualizar" },
  delete: { success: "Excluído com sucesso!", error: "Erro ao excluir" },
};

const EMPTY_PAGE: PagedResult<never> = { items: [], page: 1, pageSize: 0, total: 0, totalPages: 1 };

export function usePaginatedDataQuery<T extends object>(
  config: PaginatedQueryConfig<T>,
  messages: MutationMessages = defaultMessages,
) {
  const queryClient = useQueryClient();

  const {
    queryKey: baseKey,
    table,
    page,
    pageSize,
    search,
    searchParam = "search",
    filters,
    orderBy = { column: "created_at", ascending: false },
    enabled = true,
    additionalInvalidateKeys,
    onMutationSuccess,
  } = config;

  const mergedFilters = search ? { ...filters, [searchParam]: search } : filters;

  // page/pageSize/search/filters/sort are part of the query identity:
  // without it, changing page would (incorrectly) reuse the cache of the
  // previous page, or worse, a filter change would return data from
  // another filter — exactly the "too generic queryKey" risk.
  const queryKey = [...baseKey, "paged", page, pageSize, search ?? "", JSON.stringify(filters ?? {}), orderBy.column, orderBy.ascending ?? false] as const;

  const cacheConfig = getCacheConfig(baseKey);

  const query = useQuery<PagedResult<T>>({
    queryKey,
    queryFn: ({ signal }) =>
      storage.listPaged<T & { id: string }>(table, { page, pageSize, filters: mergedFilters, orderBy, signal }) as Promise<PagedResult<T>>,
    enabled,
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
    // Keeps the previous page visible while the new one loads — changing
    // page must not flash to skeleton/empty on each click.
    placeholderData: keepPreviousData,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: baseKey });
    if (additionalInvalidateKeys) {
      additionalInvalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (item: Omit<T, "id" | "created_at" | "updated_at" | "user_id">) =>
      storage.create<T & { id: string }>(
        table,
        item as Omit<T & { id: string }, "id" | "user_id" | "created_at" | "updated_at">,
      ) as T,
    onSuccess: (result) => {
      invalidateAll();
      toast.success(messages.create?.success || defaultMessages.create?.success);
      onMutationSuccess?.onCreate?.(result);
    },
    onError: (error: Error) => {
      toast.error(`${messages.create?.error || defaultMessages.create?.error}: ${toUserMessage(error)}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<T>) =>
      storage.update<T & { id: string }>(table, id, data as Partial<T & { id: string }>) as T,
    onSuccess: (result) => {
      invalidateAll();
      toast.success(messages.update?.success || defaultMessages.update?.success);
      onMutationSuccess?.onUpdate?.(result);
    },
    onError: (error: Error) => {
      toast.error(`${messages.update?.error || defaultMessages.update?.error}: ${toUserMessage(error)}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await storage.delete(table, id); return id; },
    onSuccess: (id) => {
      invalidateAll();
      toast.success(messages.delete?.success || defaultMessages.delete?.success);
      onMutationSuccess?.onDelete?.(id);
    },
    onError: (error: Error) => {
      toast.error(`${messages.delete?.error || defaultMessages.delete?.error}: ${toUserMessage(error)}`);
    },
  });

  const result = query.data ?? (EMPTY_PAGE as unknown as PagedResult<T>);

  return {
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
  };
}
