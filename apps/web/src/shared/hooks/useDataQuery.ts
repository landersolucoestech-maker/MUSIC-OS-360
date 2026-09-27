import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCacheConfig } from "@/shared/lib/query-config";
import { storage } from "@/shared/lib/storage";

import { toUserMessage } from "@/shared/lib/errors";
// Stable reference: `query.data || []` would allocate a new array on every
// render while there is no data (loading, or an error with no earlier success — e.g.
// backend unavailable). Consumers that derive `useMemo`/`useEffect`
// from that array (e.g. useScheduleParticipants, which combines 4 such hooks) saw
// the dependency change identity on every render and entered an infinite
// re-render loop ("Maximum update depth exceeded"), reproduced in
// SchedulerFormModal when the backend is down.
const EMPTY_LIST: never[] = [];

/**
 * Generic CRUD hook used by every module.
 *
 * Every read and write goes through the storage layer (shared/lib/storage.ts),
 * which abstracts access to the backend (HTTP mode) or MOCK_DATA (dev mode).
 * To switch modes, use the VITE_USE_MOCK variable.
 */

/**
 * Optional callbacks invoked right after each successful mutation.
 * Used by modules to emit typed domain events without coupling to the
 * generic useDataQuery.
 */
type MutationSuccessCallbacks<T> = {
  onCreate?: (result: T) => void;
  onUpdate?: (result: T) => void;
  onDelete?: (id: string) => void;
};

type QueryConfig<T = object> = {
  queryKey: string[];
  table: string;
  /** Kept for compatibility with legacy calls (not used in mock mode). */
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, unknown>;
  enabled?: boolean;
  additionalInvalidateKeys?: string[][];
  /** Post-mutation callbacks for emitting domain events. */
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

export function useDataQuery<T extends object>(
  config: QueryConfig<T>,
  messages: MutationMessages = defaultMessages,
) {
  const queryClient = useQueryClient();

  const {
    queryKey,
    table,
    orderBy = { column: "created_at", ascending: false },
    filters,
    enabled = true,
    additionalInvalidateKeys,
    onMutationSuccess,
  } = config;

  const cacheConfig = getCacheConfig(queryKey);

  const query = useQuery<T[]>({
    queryKey,
    queryFn: async ({ signal }) =>
      (await storage.list<T & { id: string }>(table, { filters, orderBy, signal })) as T[],
    enabled,
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey });
    if (additionalInvalidateKeys) {
      additionalInvalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (
      item: Omit<T, "id" | "created_at" | "updated_at" | "user_id">,
    ) =>
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
      storage.update<T & { id: string }>(
        table,
        id,
        data as Partial<T & { id: string }>,
      ) as T,
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

  return {
    data: query.data || EMPTY_LIST,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
  };
}

export function usePaginatedQuery<T extends object>(
  config: QueryConfig<T> & { pageSize?: number },
  _messages: MutationMessages = defaultMessages,
) {
  const { pageSize = 20, ...restConfig } = config;
  const orderBy = restConfig.orderBy ?? { column: "created_at", ascending: false };

  const fetchPage = async (page: number) => {
    const from = page * pageSize;
    const to = from + pageSize;
    const sorted = await Promise.resolve(
      storage.list<T & { id: string }>(restConfig.table, {
        filters: restConfig.filters,
        orderBy,
      }),
    );
    const totalCount = sorted.length;
    return {
      data: sorted.slice(from, to) as T[],
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasMore: totalCount > to,
    };
  };

  return { fetchPage, pageSize, enabled: true };
}

