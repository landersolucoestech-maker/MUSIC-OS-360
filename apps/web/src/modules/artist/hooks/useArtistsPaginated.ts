import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { ArtistRelationshipType } from "@music-os-360/types";
import type { Artist } from "../types/artist.types";

export interface UseArtistsPaginatedParams {
  /** 0-indexado, mesma convenção de usePagination()/TablePagination. */
  page: number;
  pageSize: number;
  search?: string;
  /** exclusive/partner/independent — filtro server-side via EXISTS em contracts (ver artists.service.ts). */
  vinculo?: ArtistRelationshipType;
  genero?: string;
}

/**
 * Lista paginada server-side de artistas — companheira de useArtists()
 * (que continua servindo os usos "me dê todos os artistas": dropdowns,
 * cross-referência em useMetrics/useAgendaParticipants, mutations dos
 * modais). Task H: a tabela de /artistas usa isso para as linhas
 * exibidas; vínculo/gêneros vêm de endpoints agregados dedicados
 * (useArtistsVinculoStats/useMusicGenres), nunca da lista completa.
 */
export type ArtistWithRelationship = Artist & { vinculo?: ArtistRelationshipType };

export function useArtistsPaginated({ page, pageSize, search, vinculo, genero }: UseArtistsPaginatedParams) {
  const filters: Record<string, unknown> = {};
  if (vinculo) filters.vinculo = vinculo;
  if (genero) filters.genre = genero;

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

/** GET /artists/stats/vinculo — contagem exata por vínculo, tenant inteiro. */
export function useArtistsVinculoStats() {
  const query = useQuery<VinculoStats>({
    queryKey: [...QUERY_KEYS.ARTISTS, "stats", "vinculo"],
    queryFn: ({ signal }) => api.get<VinculoStats>("/artists/stats/vinculo", { signal }),
    staleTime: 30_000,
  });
  return { stats: query.data ?? EMPTY_VINCULO, isLoading: query.isLoading, error: query.error };
}

/** GET /artists/stats/generos — gêneros distintos do tenant, para o filtro. */
export function useMusicGenres() {
  const query = useQuery<string[]>({
    queryKey: [...QUERY_KEYS.ARTISTS, "stats", "generos"],
    queryFn: ({ signal }) => api.get<string[]>("/artists/stats/generos", { signal }),
    staleTime: 60_000,
  });
  return { genres: query.data ?? EMPTY_GENRES, isLoading: query.isLoading };
}
