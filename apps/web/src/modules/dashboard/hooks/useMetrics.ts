/**
 * modules/dashboard/hooks/useMetrics.ts
 *
 * Cross-module metrics aggregator hook for the Dashboard.
 * It belongs to the dashboard module — it is NOT shared, because it imports directly
 * from domain modules. Shared never imports from modules.
 *
 * Task G: counts/sums (totalArtists, activeContracts, expiringContracts,
 * monthlyRevenue) now come from useOperationalDashboard() — GET /analytics/dashboard,
 * which already computes everything via COUNT/SUM in the database (see AnalyticsService.getDashboard) —
 * instead of downloading the whole contracts/transactions/clients tables just to
 * sum them on the client. Only the lists whose RECORDS (not
 * aggregates) are displayed are still fetched: artists (for "highlights") and
 * releases/projects (to count per artist in the highlights). Event counts and the
 * upcoming appointments come from starts_at-scoped queries (useDashboardEvents).
 */
import { useMemo } from "react";
import { useArtists, type Artist } from "@/modules/artist/hooks/useArtists";
import type { EventWithRelations } from "@/modules/events/hooks/useEvents";
import { useReleases } from "@/modules/releases/hooks/useReleases";
import { useProjects } from "@/modules/projects/hooks/useProjects";
import { useOperationalDashboard } from "./useOperationalDashboard";
import { useDashboardEvents } from "./useDashboardEvents";

interface FeaturedArtist {
  id: string;
  stageName: string;
  musicGenre: string | null;
  releasesCount: number;
  /** null = streams data not integrated yet (do not display as 0). */
  streams: number | null;
  projectsCount: number;
  photoUrl: string | null;
  /** The full artist record — opened by the 360 view. */
  artist: Artist;
}

interface ArtistsMetrics {
  total: number;
  totalArtists: number;
  withContract: number;
  active: number;
}

interface DashboardMetrics {
  totalArtists: number;
  activeContracts: number;
  expiringContracts: number;
  monthlyRevenue: number;
  eventsMonth: number;
  featuredArtists: FeaturedArtist[];
}

export interface UseMetricsReturn {
  artistsMetrics: ArtistsMetrics;
  dashboardMetrics: DashboardMetrics;
  /** Next open appointments (starts_at >= now), at most UPCOMING_APPOINTMENTS_LIMIT. */
  upcomingEvents: EventWithRelations[];
  /** The events queries failed with nothing cached: event counts/appointments are unknown, not zero. */
  eventsUnavailable: boolean;
  /** The upcoming list may miss appointments (see DashboardEvents.upcomingIncomplete). */
  upcomingIncomplete: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMetrics(): UseMetricsReturn {
  const { artists, isLoading: loadingArtists, error: errArtists, refetch: refetchArtists } = useArtists();
  const { dashboardEvents, isLoading: loadingEvents, error: errEvents, refetch: refetchEvents } = useDashboardEvents();
  const { releases: releasesData, isLoading: loadingReleases, error: errReleases, refetch: refetchReleases } = useReleases();
  const { projects, isLoading: loadingProjects, error: errProjects, refetch: refetchProjects } = useProjects();
  const { dashboard, isLoading: loadingAgg, error: errAgg, refetch: refetchAgg } = useOperationalDashboard();

  const refetch = () => {
    refetchArtists(); refetchEvents(); refetchReleases(); refetchProjects(); refetchAgg();
  };

  // None of the 5 sources loaded successfully: zeroed KPIs in this case mean
  // unavailability, not real data — Dashboard.tsx uses this to decide
  // between showing the KPIs or a "could not load" banner.
  const error = (errArtists || errEvents || errReleases || errProjects || errAgg) &&
    artists.length === 0 && !dashboardEvents && releasesData.length === 0 &&
    projects.length === 0 && !dashboard
    ? (errArtists || errEvents || errReleases || errProjects || errAgg)
    : null;
  const isLoading = loadingArtists || loadingEvents || loadingReleases || loadingProjects || loadingAgg;

  const artistsMetrics = useMemo<ArtistsMetrics>(() => {
    // Task J: contrato_id/status are a 1:1 business rule on the backend (an artist
    // only enters status "signed" with contrato_id filled in — see
    // ArtistsService.changeStatus) — that is why `artists_by_status.signed`
    // from the GET /analytics/dashboard aggregate (real COUNT in the database, never
    // capped) covers exactly "artists with an active contract", without needing
    // a new endpoint. It falls back to the capped array (artistas.length) only if the
    // aggregate has not loaded yet — same fallback pattern as totalArtists.
    const statusCounts = dashboard?.artists_by_status;
    const artistsWithContract = statusCounts
      ? (statusCounts["signed"] ?? 0)
      : artists.filter(a => a.contractId).length;
    const activeArtists = statusCounts
      ? (statusCounts["active"] ?? 0) + (statusCounts["signed"] ?? 0)
      : artists.filter(a => a.status === "active" || a.status === "signed").length;

    return {
      total: artists.length,
      totalArtists: dashboard?.artists ?? artists.length,
      withContract: artistsWithContract,
      active: activeArtists,
    };
  }, [artists, dashboard]);

  const dashboardMetrics = useMemo<DashboardMetrics>(() => {
    const artistsWithMetrics: FeaturedArtist[] = artists.map(artist => {
      const releases = releasesData.filter(l => l.artist_id === artist.id).length;
      const projectsCount = projects.filter(p => p.artist_id === artist.id).length;

      // Streams: tries multiple sources; if none is available, returns null
      // so the UI can show "–" instead of a false "0".
      const a = artist as unknown as Record<string, unknown>;
      const integrationsData = a["integrations_data"] as Record<string, unknown> | undefined;
      const spotifyData = integrationsData?.["spotify"] as Record<string, unknown> | undefined;
      const streamsRaw =
        artist.spotifyListeners ??
        (spotifyData?.["monthly_listeners"] as number | undefined) ??
        (spotifyData?.["listeners"] as number | undefined);
      const streams = typeof streamsRaw === "number" && Number.isFinite(streamsRaw)
        ? streamsRaw
        : null;

      return {
        id: artist.id,
        stageName: artist.stageName,
        musicGenre: artist.musicGenre ?? null,
        releasesCount: releases,
        streams,
        projectsCount,
        photoUrl: artist.photoUrl ?? null,
        artist,
      };
    });

    const featuredArtists = artistsWithMetrics
      .sort((a, b) => {
        if (b.releasesCount !== a.releasesCount) return b.releasesCount - a.releasesCount;
        return b.projectsCount - a.projectsCount;
      })
      .slice(0, 4);

    return {
      totalArtists: dashboard?.artists ?? artists.length,
      activeContracts: dashboard?.active_contracts_count ?? 0,
      expiringContracts: dashboard?.contracts_expiring_soon_count ?? 0,
      monthlyRevenue: dashboard?.revenue_current_month ?? 0,
      eventsMonth: dashboardEvents?.monthCount ?? 0,
      featuredArtists,
    };
  }, [artists, dashboardEvents, releasesData, projects, dashboard]);

  return {
    artistsMetrics,
    dashboardMetrics,
    upcomingEvents: dashboardEvents?.upcoming ?? [],
    eventsUnavailable: !!errEvents && !dashboardEvents,
    upcomingIncomplete: dashboardEvents?.upcomingIncomplete ?? false,
    isLoading,
    error,
    refetch,
  };
}
