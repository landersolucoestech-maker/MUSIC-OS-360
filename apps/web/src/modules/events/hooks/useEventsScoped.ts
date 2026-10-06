import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { EventWithRelations } from "./useEvents";

export interface UseEventsScopedParams {
  /** ISO date-time bounds of the period visible in the calendar (day/week/month/year). */
  dateFrom: string;
  dateTo: string;
  search?: string;
  type?: string;
  status?: string;
}

/**
 * Events of the currently visible calendar period — never the whole
 * table. `useEvents()` without filters was stuck at the backend default
 * (limit=50, see PaginationDto), so tenants with more than 50 events in
 * total silently lost events in any navigated month/week.
 * Scoping by dateFrom/dateTo (real `data` column) fixes it: each
 * period has, in practice, far fewer than 200 events.
 */
export function useEventsScoped({ dateFrom, dateTo, search, type, status }: UseEventsScopedParams) {
  const filters: Record<string, unknown> = { dateFrom, dateTo };
  if (type) filters.type = type;
  if (status) filters.status = status;

  const result = usePaginatedDataQuery<EventWithRelations>({
    queryKey: [...QUERY_KEYS.EVENTS, "scoped"],
    table: "events",
    page: 1,
    pageSize: 200,
    search,
    filters,
  });

  return {
    events: result.items,
    total: result.total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface EventsKPIs {
  total: number;
  confirmed: number;
  pending: number;
  upcoming7Days: number;
}

const EMPTY_KPIS: EventsKPIs = { total: 0, confirmed: 0, pending: 0, upcoming7Days: 0 };

interface StatsResponse {
  total: number;
  byGroup: Record<string, number>;
  upcoming7Days: number;
}

/** GET /events/stats — exact tenant-wide KPIs, independent of the calendar period. */
export function useEventsStats() {
  const query = useQuery<StatsResponse>({
    queryKey: [...QUERY_KEYS.EVENTS, "stats"],
    queryFn: ({ signal }) => api.get<StatsResponse>("/events/stats", { signal }),
    staleTime: 30_000,
  });

  const data = query.data;
  // byGroup groups by the real events.status — canonical English value (see
  // @music-os-360/types EventStatus / EventsService.stats()), not pt-BR.
  const kpis: EventsKPIs = !data ? EMPTY_KPIS : {
    total: data.total,
    confirmed: data.byGroup["confirmed"] ?? 0,
    pending: (data.byGroup["planned"] ?? 0) + (data.byGroup["scheduled"] ?? 0),
    upcoming7Days: data.upcoming7Days,
  };

  return { kpis, isLoading: query.isLoading, error: query.error };
}
