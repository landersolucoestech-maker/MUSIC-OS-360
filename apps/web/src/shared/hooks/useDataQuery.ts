import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCacheConfig } from "@/shared/lib/query-config";
import { storage } from "@/shared/lib/storage";

import { toUserMessage } from "@/shared/lib/errors";
// Referência estável: `query.data || []` alocaria um array novo a cada
// render enquanto não há dado (loading, ou erro sem sucesso anterior — ex.:
// backend indisponível). Consumidores que derivam `useMemo`/`useEffect`
// desse array (ex.: useAgendaParticipants, que combina 4 hooks assim) viam
// a dependência mudar de identidade a cada render e entravam em loop de
// re-render infinito ("Maximum update depth exceeded"), reproduzido em
// SchedulerFormModal quando o backend está fora do ar.
const EMPTY_LIST: never[] = [];

/**
 * Hook genérico de CRUD usado por todos os módulos.
 *
 * Toda leitura e escrita passa pela camada de storage (shared/lib/storage.ts),
 * que abstrai o acesso ao backend (HTTP mode) ou MOCK_DATA (dev mode).
 * Para alternar entre modos, use a variável VITE_USE_MOCK.
 */

/**
 * Callbacks opcionais invocados imediatamente após cada mutação bem-sucedida.
 * Usados pelos módulos para emitir domain events tipados sem acoplamento ao
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
  /** Mantido para compatibilidade com chamadas legadas (não usado em modo mock). */
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, unknown>;
  enabled?: boolean;
  additionalInvalidateKeys?: string[][];
  /** Callbacks pós-mutação para emissão de domain events. */
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

