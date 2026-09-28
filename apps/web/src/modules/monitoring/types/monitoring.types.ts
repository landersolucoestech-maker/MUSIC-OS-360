import type { TakedownStatus } from "@/shared/types/enums";

export type { TakedownStatus };

/** Takedown as the API returns it (canonical English fields, CZ-034). */
export interface Takedown {
  id: string;
  title?: string | null;
  /** sent | received */
  type?: string | null;
  work_id?: string | null;
  artist_id?: string | null;
  affected_work?: string | null;
  artist_name?: string | null;
  platform?: string | null;
  /** high | medium | low */
  priority?: string | null;
  /** Legacy mirror of infringing_url. */
  url?: string | null;
  infringing_url?: string | null;
  status?: TakedownStatus | string | null;
  reason?: string | null;
  response?: string | null;
  description?: string | null;
  evidence?: string | null;
  identified_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type TakedownInsert = Omit<Takedown, "id" | "created_at" | "updated_at">;
export type TakedownUpdate = Partial<TakedownInsert>;

