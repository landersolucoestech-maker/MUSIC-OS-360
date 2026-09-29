import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { storage } from "@/shared/lib/storage";
import { systemTimezoneDayAndMonthBounds } from "@/shared/lib/format-utils";
import type { EventWithRelations } from "@/modules/events/hooks/useEvents";
import { isUpcomingAppointmentStatus } from "@/modules/dashboard/lib/appointments";

export interface DashboardEvents {
  /** Events whose starts_at falls in the current month (system timezone), counted by the API. */
  monthCount: number;
  /** The next open appointments (starts_at >= now, closed statuses excluded), oldest first. */
  upcoming: EventWithRelations[];
  /**
   * true when fewer than UPCOMING_APPOINTMENTS_LIMIT open appointments were found
   * but the page limit stopped the scan before the end of the agenda (many closed
   * events ahead): the list may be missing appointments.
   */
  upcomingIncomplete: boolean;
}

export const UPCOMING_APPOINTMENTS_LIMIT = 5;
const UPCOMING_PAGE_SIZE = 50;
const UPCOMING_MAX_PAGES = 4;

/**
 * Dashboard events, scoped on the server. The unfiltered `useEvents()` list is
 * capped at the API default (50 rows ordered by starts_at ascending), so a
 * tenant with more than 50 events only ever saw its 50 oldest: no upcoming
 * appointments and zeroed day/month counters. Counts come from the API total of
 * a starts_at-bounded query (month boundaries in the system timezone, not the
 * browser's); upcoming events from a query starting now.
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
    let reachedEnd = false;
    for (let page = 1; page <= UPCOMING_MAX_PAGES && upcoming.length < UPCOMING_APPOINTMENTS_LIMIT; page++) {
      const result = await storage.listPaged<EventWithRelations>("events", {
        page,
        pageSize: UPCOMING_PAGE_SIZE,
        filters: { dateFrom: now.toISOString() },
        orderBy: { column: "starts_at", ascending: true },
        signal,
      });
      upcoming.push(...result.items.filter((e) => isUpcomingAppointmentStatus(e.status)));
      if (page >= result.totalPages) {
        reachedEnd = true;
        break;
      }
    }
    return {
      upcoming: upcoming.slice(0, UPCOMING_APPOINTMENTS_LIMIT),
      upcomingIncomplete: upcoming.length < UPCOMING_APPOINTMENTS_LIMIT && !reachedEnd,
    };
  };

  const { monthStart, monthEnd } = systemTimezoneDayAndMonthBounds(now);
  const [monthCount, { upcoming, upcomingIncomplete }] = await Promise.all([
    countBetween(monthStart, monthEnd),
    fetchUpcoming(),
  ]);
  return { monthCount, upcoming, upcomingIncomplete };
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
