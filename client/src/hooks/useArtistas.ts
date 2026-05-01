import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Artista = Tables<"artistas"> & {
  nome_civil?: string | null;
  genero_musical?: string | null;
  observacoes?: string | null;
  status_cadastro?: string | null;
  cpf_cnpj?: string | null;
  foto_url?: string | null;
};
export type ArtistaInsert = Omit<TablesInsert<"artistas">, "user_id" | "id" | "created_at" | "updated_at"> & {
  status_cadastro?: string | null;
  cpf_cnpj?: string | null;
  foto_url?: string | null;
};
export type ArtistaUpdate = Omit<TablesUpdate<"artistas">, "id" | "user_id" | "created_at" | "updated_at"> & {
  status_cadastro?: string | null;
  cpf_cnpj?: string | null;
  foto_url?: string | null;
};

export function useArtistas() {
  const result = useSupabaseQuery<Artista>({
    queryKey: [...QUERY_KEYS.ARTISTAS],
    table: "artistas",
  }, {
    create: { success: "Artista criado com sucesso!", error: "Erro ao criar artista" },
    update: { success: "Artista atualizado com sucesso!", error: "Erro ao atualizar artista" },
    delete: { success: "Artista excluído com sucesso!", error: "Erro ao excluir artista" },
  });

  return {
    artistas: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addArtista: result.create,
    updateArtista: result.update,
    deleteArtista: result.delete,
  };
}
