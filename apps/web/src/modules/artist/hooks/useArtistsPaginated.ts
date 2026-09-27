import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { ArtistRelationshipType } from "@music-os-360/types";
import type { Artist } from "../types/artist.types";

export interface UseArtistsPaginatedParams {
  /** 0-indexed, same convention as usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  /** exclusive/partner/independent — server-side filter via EXISTS on contracts (see artists.service.ts). */
  vinculo?: ArtistRelationshipType;
  genero?: string;
}

/**
 * Server-side paginated artist list — companion of useArtists() (which still
 * serves the "give me every artist" uses: dropdowns, cross-reference in
 * useMetrics/useScheduleParticipants, modal mutations). Task H: the /artistas
 * table uses this for the displayed rows; contract type/genres come from
 * dedicated aggregate endpoints (useArtistsVinculoStats/useMusicGenres), never
 * from the full list.
 */
export type ArtistWithRelationship = Artist & { vinculo?: ArtistRelationshipType };

export function useArtistsPaginated({ page, pageSize, search, vinculo, genero: genre }: UseArtistsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (vinculo) filters.vinculo = vinculo;
  if (genre) filters.genre = genre;

  const result = usePaginatedDataQuery<ArtistWireRecord>({
    queryKey: [...QUERY_KEYS.ARTISTS],
    table: "artistas",
    page: page + 1,
    pageSize,
    search,
    filters,
  });

  return {
    artists: result.items.map((item) => wireToArtist(item) as ArtistWithRelationship),
    total: result.total,
    totalPages: result.totalPages,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface VinculoStats {
  exclusive: number;
  partner: number;
  independent: number;
  total: number;
}

const EMPTY_VINCULO: VinculoStats = { exclusive: 0, partner: 0, independent: 0, total: 0 };
const EMPTY_GENRES: string[] = [];

/** GET /artists/stats/vinculo — exact count per contract type, whole tenant. */
export function useArtistsVinculoStats() {
  const query = useQuery<VinculoStats>({
    queryKey: [...QUERY_KEYS.ARTISTS, "stats", "vinculo"],
    queryFn: ({ signal }) => api.get<VinculoStats>("/artists/stats/vinculo", { signal }),
    staleTime: 30_000,
  });
  return { stats: query.data ?? EMPTY_VINCULO, isLoading: query.isLoading, error: query.error };
}

/** GET /artists/stats/genres — the tenant's distinct genres, for the filter. */
export function useMusicGenres() {
  const query = useQuery<string[]>({
    queryKey: [...QUERY_KEYS.ARTISTS, "stats", "genres"],
    queryFn: ({ signal }) => api.get<string[]>("/artists/stats/genres", { signal }),
    staleTime: 60_000,
  });
  return { genres: query.data ?? EMPTY_GENRES, isLoading: query.isLoading };
}
