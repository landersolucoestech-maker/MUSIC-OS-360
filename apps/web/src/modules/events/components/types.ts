import type { EventStatusValue } from "@/modules/events/types/events.types";

// SchedulerStatus carrega o valor real de events.status (backend, canônico em
// inglês — ver @music-os-360/types EventStatus). O `| string` preserva
// compatibilidade com valores legados/desconhecidos vindos de dados antigos.
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
