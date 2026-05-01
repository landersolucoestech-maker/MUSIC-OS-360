import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/types/database";
import { MOCK_ARTISTAS_ASSINADOS } from "@/data/mockData";

export type ArtistaAssinado = Tables<"artistas">;

/**
 * Lista artistas com pelo menos 1 contrato status='assinado'.
 *
 * Sem backend, devolvemos diretamente o subconjunto pré-filtrado
 * `MOCK_ARTISTAS_ASSINADOS` do mock layer.
 */
export function useArtistasAssinados() {
  const query = useQuery<ArtistaAssinado[]>({
    queryKey: ["artistas", "assinados"],
    queryFn: async () => MOCK_ARTISTAS_ASSINADOS as unknown as ArtistaAssinado[],
  });

  return {
    artistas: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
