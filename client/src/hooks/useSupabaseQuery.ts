import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCacheConfig } from "@/lib/query-config";
import { MOCK_DATA, MOCK_USER_ID, saveMockData } from "@/data/mockData";

/**
 * Hook genérico de CRUD usado por todos os módulos.
 *
 * Antes este hook conversava com o Supabase. Hoje o app opera 100%
 * standalone — todas as leituras e mutações vão direto para
 * `MOCK_DATA` (em memória + persistência em localStorage via
 * `saveMockData`). O nome `useSupabaseQuery` foi mantido para evitar
 * uma refatoração massiva nas centenas de páginas que o consomem.
 */

type QueryConfig<T> = {
  queryKey: string[];
  table: string;
  /**
   * Mantido para compatibilidade com chamadas legadas. Não é usado
   * em modo mock, já que devolvemos a linha inteira.
   */
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, unknown>;
  enabled?: boolean;
  additionalInvalidateKeys?: string[][];
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

function applyFilters<T>(rows: T[], filters?: Record<string, unknown>): T[] {
  if (!filters) return rows;
  return rows.filter((row) =>
    Object.entries(filters).every(
      ([k, v]) =>
        v === undefined ||
        v === null ||
        (row as Record<string, unknown>)[k] === v,
    ),
  );
}

function sortRows<T>(
  rows: T[],
  orderBy: { column: string; ascending?: boolean },
): T[] {
  const ascending = orderBy.ascending ?? false;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[orderBy.column];
    const bv = (b as Record<string, unknown>)[orderBy.column];
    if (av === bv) return 0;
    if (av === undefined || av === null) return ascending ? -1 : 1;
    if (bv === undefined || bv === null) return ascending ? 1 : -1;
    if (av < bv) return ascending ? -1 : 1;
    if (av > bv) return ascending ? 1 : -1;
    return 0;
  });
}

export function useSupabaseQuery<T extends Record<string, unknown>>(
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
  } = config;

  const cacheConfig = getCacheConfig(queryKey);

  const query = useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const mockRows = (MOCK_DATA[table] ?? []) as T[];
      const filtered = applyFilters(mockRows, filters);
      return sortRows(filtered, orderBy);
    },
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
    ) => {
      const newItem = {
        ...item,
        id: `mock-new-${Date.now()}`,
        user_id: MOCK_USER_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as T;
      const arr = (MOCK_DATA[table] ?? (MOCK_DATA[table] = [])) as T[];
      arr.unshift(newItem);
      saveMockData();
      return newItem;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(
        messages.create?.success || defaultMessages.create?.success,
      );
    },
    onError: (error: Error) => {
      toast.error(
        `${messages.create?.error || defaultMessages.create?.error}: ${error.message}`,
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<T>) => {
      const arr = (MOCK_DATA[table] ?? []) as T[];
      const idx = arr.findIndex((r) => (r as Record<string, unknown>).id === id);
      if (idx >= 0) {
        arr[idx] = {
          ...arr[idx],
          ...data,
          updated_at: new Date().toISOString(),
        } as T;
      }
      saveMockData();
      return arr[idx] as T;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(
        messages.update?.success || defaultMessages.update?.success,
      );
    },
    onError: (error: Error) => {
      toast.error(
        `${messages.update?.error || defaultMessages.update?.error}: ${error.message}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const arr = (MOCK_DATA[table] ?? []) as T[];
      const idx = arr.findIndex((r) => (r as Record<string, unknown>).id === id);
      if (idx >= 0) arr.splice(idx, 1);
      saveMockData();
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(
        messages.delete?.success || defaultMessages.delete?.success,
      );
    },
    onError: (error: Error) => {
      toast.error(
        `${messages.delete?.error || defaultMessages.delete?.error}: ${error.message}`,
      );
    },
  });

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
  };
}

export function usePaginatedQuery<T extends Record<string, unknown>>(
  config: QueryConfig<T> & { pageSize?: number },
  _messages: MutationMessages = defaultMessages,
) {
  const { pageSize = 20, ...restConfig } = config;
  const orderBy = restConfig.orderBy ?? {
    column: "created_at",
    ascending: false,
  };

  const fetchPage = async (page: number) => {
    const from = page * pageSize;
    const to = from + pageSize;
    const mockRows = (MOCK_DATA[restConfig.table] ?? []) as T[];
    const filtered = applyFilters(mockRows, restConfig.filters);
    const sorted = sortRows(filtered, orderBy);
    const slice = sorted.slice(from, to);
    const totalCount = sorted.length;
    return {
      data: slice,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasMore: totalCount > to,
    };
  };

  return {
    fetchPage,
    pageSize,
    enabled: true,
  };
}
