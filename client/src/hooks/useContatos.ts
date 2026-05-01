import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Contato = Tables<"contatos">;
export type ContatoInsert = Omit<TablesInsert<"contatos">, "user_id">;
export type ContatoUpdate = TablesUpdate<"contatos">;

export type ContatoWithRelations = Contato & {
  artistas?: Tables<"artistas"> | null;
  clientes?: Tables<"clientes"> | null;
};

export function useContatos() {
  const result = useSupabaseQuery<ContatoWithRelations>({
    queryKey: [...QUERY_KEYS.CONTATOS],
    table: "contatos",
    select: "*, artistas(*), clientes(*)",
  }, {
    create: { success: "Contato criado com sucesso!", error: "Erro ao criar contato" },
    update: { success: "Contato atualizado com sucesso!", error: "Erro ao atualizar contato" },
    delete: { success: "Contato excluído com sucesso!", error: "Erro ao excluir contato" },
  });

  return {
    contatos: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addContato: result.create,
    updateContato: result.update,
    deleteContato: result.delete,
  };
}
