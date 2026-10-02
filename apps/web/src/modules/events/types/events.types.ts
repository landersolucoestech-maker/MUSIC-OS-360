import type { ArtistRef } from "@/shared/types/refs";
import type { EventType, EventStatusValue } from "@/shared/types/enums";

export type { EventType, EventStatusValue };

export interface Event {
  id: string;
  title: string;
  type?: EventType | string | null;
  status?: EventStatusValue | string | null;
  artist_id?: string | null;
  starts_at?: string | null;
  end_date?: string | null;
  venue?: string | null;
  venue_contact?: string | null;
  address?: string | null;
  fee_amount?: number | string | null;
  expected_attendance?: number | null;
  participants?: unknown[] | null;
  description?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type EventInsert = Omit<Event, "id" | "user_id" | "created_at" | "updated_at">;
export type EventUpdate = Partial<EventInsert>;

export interface EventWithRelations extends Event {
  artist?: ArtistRef | null;
}

