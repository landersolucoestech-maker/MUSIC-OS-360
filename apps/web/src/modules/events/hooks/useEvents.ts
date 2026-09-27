import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { Event, EventInsert, EventUpdate, EventWithRelations } from "../types/events.types";

export type { Event, EventInsert, EventUpdate, EventWithRelations };

export function useEvents(enabled = true, artistId?: string) {
  const result = useDataQuery<EventWithRelations>({
    queryKey: artistId ? [...QUERY_KEYS.EVENTS, "by-artist", artistId] : [...QUERY_KEYS.EVENTS],
    table: "events",
    orderBy: { column: "starts_at", ascending: true },
    enabled,
    // EventsService.list() only reads "artist_id" (snake_case); "artistId" (camelCase)
    // exists in the DTO only for compatibility and is never read — see events.dto.ts.
    filters: artistId ? { artist_id: artistId } : undefined,
  }, {
    create: { success: "Evento criado com sucesso!", error: "Erro ao criar evento" },
    update: { success: "Evento atualizado com sucesso!", error: "Erro ao atualizar evento" },
    delete: { success: "Evento excluído com sucesso!", error: "Erro ao excluir evento" },
  });

  return {
    events: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addEvent: result.create,
    updateEvent: result.update,
    deleteEvent: result.delete,
  };
}
