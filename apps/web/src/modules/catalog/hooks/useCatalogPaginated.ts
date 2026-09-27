import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { Work, Phonogram } from "../types/catalog.types";

export interface GroupStatsResult {
  total: number;
  byGroup: Record<string, number>;
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

const EMPTY_STATS: GroupStatsResult = { total: 0, byGroup: {} };
const EMPTY_GENRES: string[] = [];

export interface UseWorksPaginatedParams {
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

export function useWorksPaginated({
  page, pageSize, search, status, tipoObra: workType, genero: genre, projectId, ecad, enabled = true,
}: UseWorksPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (workType) filters.tipo_obra = workType;
  if (genre) filters.music_genre = genre;
  if (projectId) filters.project_id = projectId;
  if (ecad) filters.ecad = ecad;

  const result = usePaginatedDataQuery<Work>({
    queryKey: [...QUERY_KEYS.WORKS],
    table: "obras",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    works: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useWorksStats(query: { status?: string; tipoObra?: string; genero?: string; projectId?: string; ecad?: string } = {}) {
  const q = useQuery<GroupStatsResult>({
    queryKey: [...QUERY_KEYS.WORKS, "stats", query],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (query.status) params.set("status", query.status);
      if (query.tipoObra) params.set("tipo_obra", query.tipoObra);
      if (query.genero) params.set("music_genre", query.genero);
      if (query.projectId) params.set("project_id", query.projectId);
      if (query.ecad) params.set("ecad", query.ecad);
      const qs = params.toString();
      return api.get<GroupStatsResult>(`/works/stats${qs ? `?${qs}` : ""}`, { signal });
    },
    staleTime: 30_000,
  });
  return { stats: q.data ?? EMPTY_STATS, isLoading: q.isLoading, error: q.error };
}

export function useWorksGenres() {
  const q = useQuery<string[]>({
    queryKey: [...QUERY_KEYS.WORKS, "stats", "generos"],
    queryFn: ({ signal }) => api.get<string[]>("/works/stats/generos", { signal }),
    staleTime: 60_000,
  });
  return { generos: q.data ?? EMPTY_GENRES, isLoading: q.isLoading };
}

export interface UsePhonogramsPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  genero?: string;
  obraVinculada?: "com-obra" | "sem-obra";
  ecad?: "com-ecad" | "sem-ecad";
  enabled?: boolean;
}

export function usePhonogramsPaginated({
  page, pageSize, search, status, genero: genre, obraVinculada: linkedWork, ecad, enabled = true,
}: UsePhonogramsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (genre) filters.music_genre = genre;
  if (linkedWork) filters.obra_vinculada = linkedWork;
  if (ecad) filters.ecad = ecad;

  const result = usePaginatedDataQuery<Phonogram>({
    queryKey: [...QUERY_KEYS.PHONOGRAMS],
    table: "fonogramas",
    page: page + 1,
    pageSize,
    search,
    filters,
    enabled,
  });

  return {
    phonograms: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export function usePhonogramsStats(query: { status?: string; genero?: string; obraVinculada?: string; ecad?: string } = {}) {
  const q = useQuery<GroupStatsResult>({
    queryKey: [...QUERY_KEYS.PHONOGRAMS, "stats", query],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (query.status) params.set("status", query.status);
      if (query.genero) params.set("music_genre", query.genero);
      if (query.obraVinculada) params.set("obra_vinculada", query.obraVinculada);
      if (query.ecad) params.set("ecad", query.ecad);
      const qs = params.toString();
      return api.get<GroupStatsResult>(`/phonograms/stats${qs ? `?${qs}` : ""}`, { signal });
    },
    staleTime: 30_000,
  });
  return { stats: q.data ?? EMPTY_STATS, isLoading: q.isLoading, error: q.error };
}

export function usePhonogramsGenres() {
  const q = useQuery<string[]>({
    queryKey: [...QUERY_KEYS.PHONOGRAMS, "stats", "generos"],
    queryFn: ({ signal }) => api.get<string[]>("/phonograms/stats/generos", { signal }),
    staleTime: 60_000,
  });
  return { generos: q.data ?? EMPTY_GENRES, isLoading: q.isLoading };
}
