/**
 * Every event of one artist, for the 360° View (agenda, next/first show,
 * timeline). `useEvents()` inherits the API's default page (limit 50, starts_at
 * ascending), so an artist with more than 50 events lost the upcoming ones.
 * This sweeps all pages with fetchAllPages and surfaces `truncated` when the
 * safety ceiling was hit. The key lives under QUERY_KEYS.EVENTS, so event
 * mutations (prefix match) refresh it too.
 */
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { fetchAllPages } from "@/shared/lib/exportAll";
import type { EventWithRelations } from "./useEvents";

export function artistEventsQueryKey(artistId: string): string[] {
  return [...QUERY_KEYS.EVENTS, "all", `artist:${artistId}`];
}

export function useArtistEvents(artistId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: artistEventsQueryKey(artistId ?? ""),
    queryFn: ({ signal }) =>
      fetchAllPages<EventWithRelations>("events", {
        // EventsService.list() only reads "artist_id" (snake_case) — see events.dto.ts.
        filters: { artist_id: artistId },
        orderBy: { column: "starts_at", ascending: true },
        signal,
      }),
    enabled: enabled && !!artistId,
    staleTime: 30_000,
  });

  return {
    events: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    truncated: query.data?.truncated ?? false,
    isLoading: query.isLoading,
    error: query.data === undefined ? query.error : null,
    refetch: query.refetch,
  };
}
