import { useQuery } from "@tanstack/react-query";
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { storage } from "@/shared/lib/storage";
import type { EventWithRelations } from "@/modules/events/hooks/useEvents";
import { isUpcomingAppointmentStatus } from "@/modules/dashboard/lib/appointments";

export interface DashboardEvents {
  /** Events whose starts_at falls today (system timezone), counted by the API. */
  todayCount: number;
  /** Events whose starts_at falls in the current month, counted by the API. */
  monthCount: number;
  /** The next open appointments (starts_at >= now, closed statuses excluded), oldest first. */
  upcoming: EventWithRelations[];
}

export const UPCOMING_APPOINTMENTS_LIMIT = 5;
const UPCOMING_PAGE_SIZE = 50;
const UPCOMING_MAX_PAGES = 4;

/**
 * Dashboard events, scoped on the server. The unfiltered `useEvents()` list is
 * capped at the API default (50 rows ordered by starts_at ascending), so a
 * tenant with more than 50 events only ever saw its 50 oldest: no upcoming
 * appointments and zeroed day/month counters. Counts come from the API total of
 * a starts_at-bounded query; upcoming events from a query starting now.
 */
export async function fetchDashboardEvents(now: Date, signal?: AbortSignal): Promise<DashboardEvents> {
  const countBetween = async (from: Date, to: Date) =>
    (await storage.listPaged<EventWithRelations>("events", {
      page: 1,
      pageSize: 1,
      filters: { dateFrom: from.toISOString(), dateTo: to.toISOString() },
      signal,
    })).total;

  const fetchUpcoming = async () => {
    const upcoming: EventWithRelations[] = [];
    for (let page = 1; page <= UPCOMING_MAX_PAGES && upcoming.length < UPCOMING_APPOINTMENTS_LIMIT; page++) {
      const result = await storage.listPaged<EventWithRelations>("events", {
        page,
        pageSize: UPCOMING_PAGE_SIZE,
        filters: { dateFrom: now.toISOString() },
        orderBy: { column: "starts_at", ascending: true },
        signal,
      });
      upcoming.push(...result.items.filter((e) => isUpcomingAppointmentStatus(e.status)));
      if (page >= result.totalPages) break;
    }
    return upcoming.slice(0, UPCOMING_APPOINTMENTS_LIMIT);
  };

  const [todayCount, monthCount, upcoming] = await Promise.all([
    countBetween(startOfDay(now), endOfDay(now)),
    countBetween(startOfMonth(now), endOfMonth(now)),
    fetchUpcoming(),
  ]);
  return { todayCount, monthCount, upcoming };
}

export function useDashboardEvents() {
  const query = useQuery<DashboardEvents>({
    queryKey: [...QUERY_KEYS.EVENTS, "dashboard"],
    queryFn: ({ signal }) => fetchDashboardEvents(new Date(), signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    dashboardEvents: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
