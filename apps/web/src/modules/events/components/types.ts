import type { EventStatusValue } from "@/modules/events/types/events.types";

// SchedulerStatus carries the real events.status value (backend, canonical
// English — see @music-os-360/types EventStatus). The `| string` keeps
// compatibility with legacy/unknown values coming from old data.
export type SchedulerStatus = EventStatusValue | string;

export type AgendaEvent = {
  id: string;
  title: string;
  artist?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  status: SchedulerStatus;
  cache?: number;
  type?: string;
  allDay?: boolean;
  raw?: unknown;
};

export type SchedulerViewMode =
  | "dia"
  | "semana"
  | "mes"
  | "ano"
  | "lista"
  | "feed";

export type SchedulerOption = {
  value: string;
  label: string;
  dot?: string;
};

export type SchedulerViewOption = {
  value: SchedulerViewMode;
  label: string;
  icon?: React.ReactNode;
};
