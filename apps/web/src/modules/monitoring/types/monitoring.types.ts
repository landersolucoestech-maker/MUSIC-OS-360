import type { ObraRef, FonogramaRef } from "@/shared/types/refs";
import type { TakedownStatus } from "@/shared/types/enums";

export type { TakedownStatus };

export interface Takedown {
  id: string;
  user_id?: string;
  title?: string | null;
  type?: string | null;
  work_id?: string | null;
  obra_afetada?: string | null;
  artista?: string | null;
  fonograma_id?: string | null;
  plataforma?: string | null;
  prioridade?: string | null;
  url?: string | null;
  url_infracao?: string | null;
  status?: TakedownStatus | string | null;
  motivo?: string | null;
  description?: string | null;
  evidencias?: string | null;
  data_identificacao?: string | null;
  data_solicitacao?: string | null;
  data_conclusao?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type TakedownInsert = Omit<Takedown, "id" | "user_id" | "created_at" | "updated_at">;
export type TakedownUpdate = Partial<TakedownInsert>;

export interface TakedownWithRelations extends Takedown {
  obras?: ObraRef | null;
  fonogramas?: FonogramaRef | null;
}
