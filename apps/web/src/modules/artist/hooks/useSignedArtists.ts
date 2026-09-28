import { useQuery } from "@tanstack/react-query";
import type { SignedArtist } from "@/modules/artist/types/artist.types";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { storage } from "@/shared/lib/storage";
import { QUERY_KEYS, getCacheConfig } from "@/shared/lib/query-config";

export type { SignedArtist };

const cacheConfig = getCacheConfig([...QUERY_KEYS.ARTISTS]);

// Stable reference — see the same comment in shared/hooks/useDataQuery.ts:
// `query.data ?? []` would allocate a new array on every render without data
// (loading, or an error with no previous success), breaking the
// useMemo/useEffect that depend on this array in the hook's consumers.
const EMPTY_ARTISTS: readonly SignedArtist[] = [];

export function useSignedArtists() {
  const query = useQuery<ArtistWireRecord[], Error, SignedArtist[]>({
    queryKey: [...QUERY_KEYS.ARTISTS],
    queryFn: async () =>
      storage.list<ArtistWireRecord>("artists"),
    select: (data) =>
      data.map(wireToArtist).filter((a) => a.status === "signed"),
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
  });

  return {
    artists: query.data ?? EMPTY_ARTISTS,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
