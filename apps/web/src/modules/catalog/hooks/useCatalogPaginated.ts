import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { Work, Phonogram } from "../types/catalog.types";
import type { WorkEcadFilter, WorkOrigin } from "../constants/work-options";
import type { PhonogramEcadFilter, PhonogramHasWorkFilter } from "../constants/phonogram-options";

export interface GroupStatsResult {
  total: number;
  byGroup: Record<string, number>;
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

const EMPTY_STATS: GroupStatsResult = { total: 0, byGroup: {} };
const EMPTY_GENRES: string[] = [];

/** Filters of GET /works (canonical query values, CZ-039). */
export interface WorksQueryFilters {
  status?: string;
  workOrigin?: WorkOrigin;
  musicGenre?: string;
  /** Project uuid, or WORK_PROJECT_FILTER_NONE ("none") for works without a project. */
  projectId?: string;
  ecad?: WorkEcadFilter;
}

export interface UseWorksPaginatedParams extends WorksQueryFilters {
  page: number;
  pageSize: number;
  search?: string;
  enabled?: boolean;
}

/** GET /works query parameters (canonical names) of the given filters. */
export function worksQueryParams(query: WorksQueryFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.status) params.status = query.status;
  if (query.workOrigin) params.work_origin = query.workOrigin;
  if (query.musicGenre) params.music_genre = query.musicGenre;
  if (query.projectId) params.project_id = query.projectId;
  if (query.ecad) params.ecad = query.ecad;
  return params;
}

export function useWorksPaginated({
  page, pageSize, search, enabled = true, ...query
}: UseWorksPaginatedParams) {
  const filters: Record<string, unknown> = worksQueryParams(query);

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

export function useWorksStats(query: WorksQueryFilters = {}) {
  const q = useQuery<GroupStatsResult>({
    queryKey: [...QUERY_KEYS.WORKS, "stats", query],
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams(worksQueryParams(query)).toString();
      return api.get<GroupStatsResult>(`/works/stats${qs ? `?${qs}` : ""}`, { signal });
    },
    staleTime: 30_000,
  });
  return { stats: q.data ?? EMPTY_STATS, isLoading: q.isLoading, error: q.error };
}

export function useWorksGenres() {
  const q = useQuery<string[]>({
    queryKey: [...QUERY_KEYS.WORKS, "stats", "genres"],
    queryFn: ({ signal }) => api.get<string[]>("/works/stats/genres", { signal }),
    staleTime: 60_000,
  });
  return { genres: q.data ?? EMPTY_GENRES, isLoading: q.isLoading };
}

/** Filters of GET /phonograms (canonical query values, CZ-040). */
export interface PhonogramsQueryFilters {
  status?: string;
  musicGenre?: string;
  /** "true" = with a linked work, "false" = without. */
  hasWork?: PhonogramHasWorkFilter;
  ecad?: PhonogramEcadFilter;
}

export interface UsePhonogramsPaginatedParams extends PhonogramsQueryFilters {
  page: number;
  pageSize: number;
  search?: string;
  enabled?: boolean;
}

/** GET /phonograms query parameters (canonical names) of the given filters. */
export function phonogramsQueryParams(query: PhonogramsQueryFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.status) params.status = query.status;
  if (query.musicGenre) params.music_genre = query.musicGenre;
  if (query.hasWork) params.has_work = query.hasWork;
  if (query.ecad) params.ecad = query.ecad;
  return params;
}

export function usePhonogramsPaginated({
  page, pageSize, search, enabled = true, ...query
}: UsePhonogramsPaginatedParams) {
  const filters: Record<string, unknown> = phonogramsQueryParams(query);

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

export function usePhonogramsStats(query: PhonogramsQueryFilters = {}) {
  const q = useQuery<GroupStatsResult>({
    queryKey: [...QUERY_KEYS.PHONOGRAMS, "stats", query],
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams(phonogramsQueryParams(query)).toString();
      return api.get<GroupStatsResult>(`/phonograms/stats${qs ? `?${qs}` : ""}`, { signal });
    },
    staleTime: 30_000,
  });
  return { stats: q.data ?? EMPTY_STATS, isLoading: q.isLoading, error: q.error };
}

export function usePhonogramsGenres() {
  const q = useQuery<string[]>({
    queryKey: [...QUERY_KEYS.PHONOGRAMS, "stats", "genres"],
    queryFn: ({ signal }) => api.get<string[]>("/phonograms/stats/genres", { signal }),
    staleTime: 60_000,
  });
  return { genres: q.data ?? EMPTY_GENRES, isLoading: q.isLoading };
}
