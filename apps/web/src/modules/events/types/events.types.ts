import type { ArtistaRef } from "@/shared/types/refs";
import type { EventType, EventStatusValue } from "@/shared/types/enums";

export type { EventType, EventStatusValue };

export interface Event {
  id: string;
  user_id?: string;
  title: string;
  tipo_evento?: EventType | string | null;
  status?: EventStatusValue | string | null;
  artist_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  local?: string | null;
  cidade?: string | null;
  estado?: string | null;
  valor_cache?: number | null;
  valor_ingresso?: number | null;
  capacidade?: number | null;
  descricao?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type EventInsert = Omit<Event, "id" | "user_id" | "created_at" | "updated_at">;
export type EventUpdate = Partial<EventInsert>;

export interface EventWithRelations extends Event {
  artistas?: ArtistaRef | null;
}

