import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Evento = Tables<"eventos">;
export type EventoInsert = Omit<TablesInsert<"eventos">, "user_id">;
export type EventoUpdate = TablesUpdate<"eventos">;

export type EventoWithRelations = Evento & {
  artistas?: Tables<"artistas"> | null;
};

export function useEventos() {
  const result = useSupabaseQuery<EventoWithRelations>({
    queryKey: [...QUERY_KEYS.EVENTOS],
    table: "eventos",
    select: "*, artistas(*)",
    orderBy: { column: "data_inicio", ascending: true },
  }, {
    create: { success: "Evento criado com sucesso!", error: "Erro ao criar evento" },
    update: { success: "Evento atualizado com sucesso!", error: "Erro ao atualizar evento" },
    delete: { success: "Evento excluído com sucesso!", error: "Erro ao excluir evento" },
  });

  return {
    eventos: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addEvento: result.create,
    updateEvento: result.update,
    deleteEvento: result.delete,
  };
}
