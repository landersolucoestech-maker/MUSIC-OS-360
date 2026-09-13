import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { Obra, Fonograma } from "../types/catalog.types";

export interface GroupStatsResult {
  total: number;
  byGroup: Record<string, number>;
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

const EMPTY_STATS: GroupStatsResult = { total: 0, byGroup: {} };
const EMPTY_GENEROS: string[] = [];

export interface UseObrasPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  tipoObra?: string;
  genero?: string;
  projectId?: string;
  ecad?: "com-ecad" | "sem-ecad";
  enabled?: boolean;
}

export function useObrasPaginated({
  page, pageSize, search, status, tipoObra, genero, projectId, ecad, enabled = true,
}: UseObrasPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (tipoObra) filters.tipo_obra = tipoObra;
  if (genero) filters.genero = genero;
  if (projectId) filters.project_id = projectId;
  if (ecad) filters.ecad = ecad;

  const result = usePaginatedDataQuery<Obra>({
    queryKey: [...QUERY_KEYS.WORKS],
    table: "obras",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    obras: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useObrasStats(query: { status?: string; tipoObra?: string; genero?: string; projectId?: string; ecad?: string } = {}) {
  const q = useQuery<GroupStatsResult>({
    queryKey: [...QUERY_KEYS.WORKS, "stats", query],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (query.status) params.set("status", query.status);
      if (query.tipoObra) params.set("tipo_obra", query.tipoObra);
      if (query.genero) params.set("genero", query.genero);
      if (query.projectId) params.set("project_id", query.projectId);
      if (query.ecad) params.set("ecad", query.ecad);
      const qs = params.toString();
      return api.get<GroupStatsResult>(`/works/stats${qs ? `?${qs}` : ""}`, { signal });
    },
    staleTime: 30_000,
  });
  return { stats: q.data ?? EMPTY_STATS, isLoading: q.isLoading, error: q.error };
}

export function useObrasGeneros() {
  const q = useQuery<string[]>({
    queryKey: [...QUERY_KEYS.WORKS, "stats", "generos"],
    queryFn: ({ signal }) => api.get<string[]>("/works/stats/generos", { signal }),
    staleTime: 60_000,
  });
  return { generos: q.data ?? EMPTY_GENEROS, isLoading: q.isLoading };
}

export interface UseFonogramasPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  genero?: string;
  obraVinculada?: "com-obra" | "sem-obra";
  ecad?: "com-ecad" | "sem-ecad";
  enabled?: boolean;
}

export function useFonogramasPaginated({
  page, pageSize, search, status, genero, obraVinculada, ecad, enabled = true,
}: UseFonogramasPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (genero) filters.genero_musical = genero;
  if (obraVinculada) filters.obra_vinculada = obraVinculada;
  if (ecad) filters.ecad = ecad;

  const result = usePaginatedDataQuery<Fonograma>({
    queryKey: [...QUERY_KEYS.PHONOGRAMS],
    table: "fonogramas",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    fonogramas: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useFonogramasStats(query: { status?: string; genero?: string; obraVinculada?: string; ecad?: string } = {}) {
  const q = useQuery<GroupStatsResult>({
    queryKey: [...QUERY_KEYS.PHONOGRAMS, "stats", query],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (query.status) params.set("status", query.status);
      if (query.genero) params.set("genero_musical", query.genero);
      if (query.obraVinculada) params.set("obra_vinculada", query.obraVinculada);
      if (query.ecad) params.set("ecad", query.ecad);
      const qs = params.toString();
      return api.get<GroupStatsResult>(`/phonograms/stats${qs ? `?${qs}` : ""}`, { signal });
    },
    staleTime: 30_000,
  });
  return { stats: q.data ?? EMPTY_STATS, isLoading: q.isLoading, error: q.error };
}

export function useFonogramasGeneros() {
  const q = useQuery<string[]>({
    queryKey: [...QUERY_KEYS.PHONOGRAMS, "stats", "generos"],
    queryFn: ({ signal }) => api.get<string[]>("/phonograms/stats/generos", { signal }),
    staleTime: 60_000,
  });
  return { generos: q.data ?? EMPTY_GENEROS, isLoading: q.isLoading };
}
