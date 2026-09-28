import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { wireToArtist, artistToWirePayload, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import type {
  Artist,
  ArtistInsert,
  ArtistUpdate,
  ArtistRelationship,
  DistributorEntry,
  ArtistResponsible,
} from "../types/artist.types";

export type {
  Artist,
  ArtistInsert,
  ArtistUpdate,
  ArtistRelationship,
  DistributorEntry,
  ArtistResponsible,
};

/**
 * PT (wire) ↔ EN (internal) boundary: `useDataQuery` talks to the API using the
 * backend's real contract (`ArtistWireRecord`, unchanged); this hook converts
 * to/from `Artist` (the internal English model) on the way in and out — see
 * `services/artist.mapper.ts` (`wireToArtist`/`artistToWirePayload`).
 */
export function useArtists() {
  const result = useDataQuery<ArtistWireRecord>({
    queryKey: [...QUERY_KEYS.ARTISTS],
    table: "artists",
  }, {
    create: { success: "Artista criado com sucesso!", error: "Erro ao criar artista" },
    update: { success: "Artista atualizado com sucesso!", error: "Erro ao atualizar artista" },
    delete: { success: "Artista excluído com sucesso!", error: "Erro ao excluir artista" },
  });

  return {
    artists: result.data.map(wireToArtist),
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addArtist: {
      ...result.create,
      mutateAsync: (data: ArtistInsert) =>
        result.create
          .mutateAsync(artistToWirePayload(data) as unknown as Omit<ArtistWireRecord, "id" | "user_id" | "created_at" | "updated_at">)
          .then(wireToArtist),
    },
    updateArtist: {
      ...result.update,
      mutateAsync: (data: { id: string; expectedUpdatedAt?: string } & Partial<ArtistUpdate>) =>
        result.update
          .mutateAsync({ id: data.id, ...artistToWirePayload(data) } as { id: string } & Partial<ArtistWireRecord>)
          .then(wireToArtist),
    },
    deleteArtist: result.delete,
  };
}
