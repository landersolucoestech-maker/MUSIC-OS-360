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
  relationship?: ArtistRelationshipType;
  genre?: string;
}

/**
 * Server-side paginated artist list — companion of useArtists() (which still
 * serves the "give me every artist" uses: dropdowns, cross-reference in
 * useMetrics/useScheduleParticipants, modal mutations). Task H: the /artists
 * table uses this for the displayed rows; contract type/genres come from
 * dedicated aggregate endpoints (useArtistRelationshipStats/useMusicGenres), never
 * from the full list.
 */
export type ArtistWithRelationship = Artist & { relationship?: ArtistRelationshipType };

export function useArtistsPaginated({ page, pageSize, search, relationship, genre }: UseArtistsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (relationship) filters.relationship = relationship;
  if (genre) filters.genre = genre;

  const result = usePaginatedDataQuery<ArtistWireRecord>({
    queryKey: [...QUERY_KEYS.ARTISTS],
    table: "artists",
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

export interface ArtistRelationshipStats {
  exclusive: number;
  partner: number;
  independent: number;
  total: number;
}

const EMPTY_RELATIONSHIP_STATS: ArtistRelationshipStats = { exclusive: 0, partner: 0, independent: 0, total: 0 };
const EMPTY_GENRES: string[] = [];

/** GET /artists/stats/relationship — exact count per contract type, whole tenant. */
export function useArtistRelationshipStats() {
  const query = useQuery<ArtistRelationshipStats>({
    queryKey: [...QUERY_KEYS.ARTISTS, "stats", "relationship"],
    queryFn: ({ signal }) => api.get<ArtistRelationshipStats>("/artists/stats/relationship", { signal }),
    staleTime: 30_000,
  });
  return { stats: query.data ?? EMPTY_RELATIONSHIP_STATS, isLoading: query.isLoading, error: query.error };
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
