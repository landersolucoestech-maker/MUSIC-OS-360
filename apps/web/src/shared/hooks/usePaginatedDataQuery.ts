import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCacheConfig } from "@/shared/lib/query-config";
import { storage, type PagedResult } from "@/shared/lib/storage";

import { toUserMessage } from "@/shared/lib/errors";
/**
 * Paginação real server-side (Task G) — companheiro de useDataQuery.ts.
 *
 * useDataQuery() busca a tabela inteira (com um limit/offset fixo passado
 * por quem chama, tipicamente nenhum → 50 registros default do backend) e é
 * o certo para "me dê tudo" (selects, cross-referência, dropdowns). Para uma
 * TABELA paginada visível ao usuário, isso é o problema descrito na Task G:
 * ou trava em 50 registros silenciosamente, ou — se alguém aumentasse o
 * limit — baixaria dezenas de milhares de linhas só pra mostrar 20.
 *
 * Este hook busca APENAS a página atual: page/pageSize/search/filters/sort
 * entram na queryKey (páginas diferentes = cache diferente, sem misturar
 * resultados) e viram query params reais (?limit=&offset=&search=&orderBy=),
 * usando os mesmos endpoints já paginados no backend (ver PaginationDto /
 * QueryArtistDto etc.) — nenhum endpoint novo foi necessário para os
 * recursos já migrados.
 */

type MutationSuccessCallbacks<T> = {
  onCreate?: (result: T) => void;
  onUpdate?: (result: T) => void;
  onDelete?: (id: string) => void;
};

export type PaginatedQueryConfig<T = object> = {
  /** Prefixo estável da queryKey — page/pageSize/search/filters/sort são anexados automaticamente. */
  queryKey: string[];
  table: string;
  page: number;
  pageSize: number;
  search?: string;
  /** Nome do query param de busca no backend (ex.: "search", "q"). Default: "search". */
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

  // page/pageSize/search/filters/sort fazem parte da identidade da query:
  // sem isso, trocar de página reaproveitaria (incorretamente) o cache da
  // página anterior, ou pior, uma mudança de filtro devolveria dados de
  // outro filtro — exatamente o risco de "queryKey genérica demais".
  const queryKey = [...baseKey, "paged", page, pageSize, search ?? "", JSON.stringify(filters ?? {}), orderBy.column, orderBy.ascending ?? false] as const;

  const cacheConfig = getCacheConfig(baseKey);

  const query = useQuery<PagedResult<T>>({
    queryKey,
    queryFn: ({ signal }) =>
      storage.listPaged<T & { id: string }>(table, { page, pageSize, filters: mergedFilters, orderBy, signal }) as Promise<PagedResult<T>>,
    enabled,
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
    // Mantém a página anterior visível enquanto a nova carrega — troca de
    // página não deve piscar para skeleton/vazio a cada clique.
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
