import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { ProjectWithRelations } from "./useProjects";

export interface UseProjectsPaginatedParams {
  /** 0-indexado, mesma convenção de usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  type?: string;
  artistId?: string;
  genero?: string;
}

export function useProjectsPaginated({ page, pageSize, search, status, type, artistId, genero }: UseProjectsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (type) filters.type = type;
  if (artistId) filters.artistId = artistId;
  if (genero) filters.genero = genero;

  const result = usePaginatedDataQuery<ProjectWithRelations>({
    queryKey: [...QUERY_KEYS.PROJECTS],
    table: "projects",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    projects: result.items,
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface ProjectStats {
  total: number;
  byGroup: Record<string, number>;
}

const EMPTY_STATS: ProjectStats = { total: 0, byGroup: {} };

/**
 * Contagem por status, sobre o TENANT INTEIRO — GET /projects/stats
 * (agregado no banco). Task H: os KPIs de Projects.tsx não podem mais ser
 * calculados só sobre a página atual (nem sobre a lista inteira baixada
 * no cliente).
 */
export function useProjectsStats() {
  const query = useQuery<ProjectStats>({
    queryKey: [...QUERY_KEYS.PROJECTS, "stats"],
    queryFn: ({ signal }) => api.get<ProjectStats>("/projects/stats", { signal }),
    staleTime: 30_000,
  });
  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
