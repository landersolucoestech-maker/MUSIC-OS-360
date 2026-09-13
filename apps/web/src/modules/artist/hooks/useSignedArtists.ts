import { useQuery } from "@tanstack/react-query";
import type { SignedArtist } from "@/modules/artist/types/artist.types";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { storage } from "@/shared/lib/storage";
import { QUERY_KEYS, getCacheConfig } from "@/shared/lib/query-config";

export type { SignedArtist };

const cacheConfig = getCacheConfig([...QUERY_KEYS.ARTISTS]);

// Referência estável — ver mesmo comentário em shared/hooks/useDataQuery.ts:
// `query.data ?? []` alocaria um array novo a cada render sem dado (loading
// ou erro sem sucesso anterior), quebrando useMemo/useEffect que dependem
// deste array em quem consome o hook.
const EMPTY_ARTISTS: readonly SignedArtist[] = [];

export function useSignedArtists() {
  const query = useQuery<ArtistWireRecord[], Error, SignedArtist[]>({
    queryKey: [...QUERY_KEYS.ARTISTS],
    queryFn: async () =>
      storage.list<ArtistWireRecord>("artistas"),
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
