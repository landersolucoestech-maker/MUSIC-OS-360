/**
 * modules/dashboard/hooks/useMetrics.ts
 *
 * Cross-module metrics aggregator hook for the Dashboard.
 * It belongs to the dashboard module — it is NOT shared, because it imports directly
 * from domain modules. Shared never imports from modules.
 *
 * Task G: counts/sums (totalArtistas, contratosAtivos, contratosVencendo,
 * receitaMensal) now come from useOperationalDashboard() — GET /analytics/dashboard,
 * which already computes everything via COUNT/SUM in the database (see AnalyticsService.getDashboard) —
 * instead of downloading the whole contracts/transactions/clients tables just to
 * sum them on the client. Only the lists whose RECORDS (not
 * aggregates) are displayed are still fetched: artists and events (for "highlights" and "upcoming
 * appointments"), releases/projects (to count per artist in the highlights).
 */
import { useMemo } from "react";
import { useArtists } from "@/modules/artist/hooks/useArtists";
import { useEvents, type EventWithRelations } from "@/modules/events/hooks/useEvents";
import { useReleases } from "@/modules/releases/hooks/useReleases";
import { useProjects } from "@/modules/projects/hooks/useProjects";
import { useOperationalDashboard } from "./useOperationalDashboard";
import { isToday, startOfMonth, endOfMonth, parseISO } from "date-fns";

interface ArtistaDestaque {
  id: string;
  stageName: string;
  musicGenre: string | null;
  lancamentos: number;
  /** null = streams data not integrated yet (do not display as 0). */
  streams: number | null;
  projetos: number;
  photoUrl: string | null;
}

interface ArtistasMetrics {
  total: number;
  totalArtistas: number;
  comContrato: number;
  ativos: number;
  totalShows: number;
  showsAgendados: number;
  showsRealizados: number;
  receitaTotal: number;
}

interface DashboardMetrics {
  totalArtistas: number;
  contratosAtivos: number;
  contratosVencendo: number;
  receitaMensal: number;
  eventosHoje: number;
  eventosMes: number;
  artistasDestaque: ArtistaDestaque[];
}

export interface UseMetricsReturn {
  artistasMetrics: ArtistasMetrics;
  dashboardMetrics: DashboardMetrics;
  eventos: EventWithRelations[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMetrics(): UseMetricsReturn {
  const { artists: artistas, isLoading: loadingArtistas, error: errArtistas, refetch: refetchArtistas } = useArtists();
  const { events: eventos, isLoading: loadingEventos, error: errEventos, refetch: refetchEventos } = useEvents();
  const { lancamentos: lancamentosData, isLoading: loadingLancamentos, error: errLancamentos, refetch: refetchLancamentos } = useReleases();
  const { projects: projetos, isLoading: loadingProjetos, error: errProjetos, refetch: refetchProjetos } = useProjects();
  const { dashboard, isLoading: loadingAgg, error: errAgg, refetch: refetchAgg } = useOperationalDashboard();

  const refetch = () => {
    refetchArtistas(); refetchEventos(); refetchLancamentos(); refetchProjetos(); refetchAgg();
  };

  // None of the 5 sources loaded successfully: zeroed KPIs in this case mean
  // unavailability, not real data — Dashboard.tsx uses this to decide
  // between showing the KPIs or a "could not load" banner.
  const error = (errArtistas || errEventos || errLancamentos || errProjetos || errAgg) &&
    artistas.length === 0 && eventos.length === 0 && lancamentosData.length === 0 &&
    projetos.length === 0 && !dashboard
    ? (errArtistas || errEventos || errLancamentos || errProjetos || errAgg)
    : null;
  const isLoading = loadingArtistas || loadingEventos || loadingLancamentos || loadingProjetos || loadingAgg;

  const artistasMetrics = useMemo<ArtistasMetrics>(() => {
    // Task J: contrato_id/status are a 1:1 business rule on the backend (an artist
    // only enters status "signed" with contrato_id filled in — see
    // ArtistsService.changeStatus) — that is why `artists_by_status.signed`
    // from the GET /analytics/dashboard aggregate (real COUNT in the database, never
    // capped) covers exactly "artists with an active contract", without needing
    // a new endpoint. It falls back to the capped array (artistas.length) only if the
    // aggregate has not loaded yet — same fallback pattern as totalArtistas.
    const statusCounts = dashboard?.artists_by_status;
    const artistasComContrato = statusCounts
      ? (statusCounts["signed"] ?? 0)
      : artistas.filter(a => a.contractId).length;
    const artistasAtivos = statusCounts
      ? (statusCounts["active"] ?? 0) + (statusCounts["signed"] ?? 0)
      : artistas.filter(a => a.status === "active" || a.status === "signed").length;
    const shows = eventos;
    const totalShows = shows.length;
    const showsAgendados = shows.filter(e => {
      const s = (e.status ?? "").toLowerCase();
      return s === "confirmado" || s === "pendente" || s === "negociacao";
    }).length;
    const showsRealizados = shows.filter(e => (e.status ?? "").toLowerCase() === "realizado").length;
    const receitaTotal = shows
      .filter(e => {
        const s = (e.status ?? "").toLowerCase();
        return s === "confirmado" || s === "realizado";
      })
      .reduce((acc, e) => acc + ((e as Record<string, unknown>)["fee_amount"] as number || 0), 0);

    return {
      total: artistas.length,
      totalArtistas: dashboard?.artists ?? artistas.length,
      comContrato: artistasComContrato,
      ativos: artistasAtivos,
      totalShows,
      showsAgendados,
      showsRealizados,
      receitaTotal,
    };
  }, [artistas, eventos, dashboard]);

  const dashboardMetrics = useMemo<DashboardMetrics>(() => {
    const hoje = new Date();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);

    // The backend returns the timestamp in the `data` column; the mock uses `start_date`.
    // Accept both to avoid a zeroed count in HTTP mode.
    const readEventoData = (e: Record<string, unknown>): string | null => {
      const v =
        (e["start_date"] as string | null | undefined) ??
        (e["data"]        as string | null | undefined) ??
        null;
      return v ?? null;
    };

    const eventosHoje = eventos.filter(e => {
      const raw = readEventoData(e as Record<string, unknown>);
      if (!raw) return false;
      try { return isToday(parseISO(raw)); } catch { return false; }
    }).length;

    const eventosMes = eventos.filter(e => {
      const raw = readEventoData(e as Record<string, unknown>);
      if (!raw) return false;
      try {
        const d = parseISO(raw);
        return d >= inicioMes && d <= fimMes;
      } catch { return false; }
    }).length;

    const artistasComMetricas: ArtistaDestaque[] = artistas.map(artista => {
      const lancamentos = lancamentosData.filter(l => l.artist_id === artista.id).length;
      const projetosCount = projetos.filter(p => p.artist_id === artista.id).length;

      // Streams: tries multiple sources; if none is available, returns null
      // so the UI can show "–" instead of a false "0".
      const a = artista as unknown as Record<string, unknown>;
      const integrationsData = a["integrations_data"] as Record<string, unknown> | undefined;
      const spotifyData = integrationsData?.["spotify"] as Record<string, unknown> | undefined;
      const streamsRaw =
        artista.spotifyListeners ??
        (spotifyData?.["monthly_listeners"] as number | undefined) ??
        (spotifyData?.["listeners"] as number | undefined);
      const streams = typeof streamsRaw === "number" && Number.isFinite(streamsRaw)
        ? streamsRaw
        : null;

      return {
        id: artista.id,
        stageName: artista.stageName,
        musicGenre: artista.musicGenre ?? null,
        lancamentos,
        streams,
        projetos: projetosCount,
        photoUrl: (a["foto_url"] as string | null) ?? null,
      };
    });

    const artistasDestaque = artistasComMetricas
      .sort((a, b) => {
        if (b.lancamentos !== a.lancamentos) return b.lancamentos - a.lancamentos;
        return b.projetos - a.projetos;
      })
      .slice(0, 4);

    return {
      totalArtistas: dashboard?.artists ?? artistas.length,
      contratosAtivos: dashboard?.active_contracts_count ?? 0,
      contratosVencendo: dashboard?.contracts_expiring_soon_count ?? 0,
      receitaMensal: dashboard?.revenue_current_month ?? 0,
      eventosHoje,
      eventosMes,
      artistasDestaque,
    };
  }, [artistas, eventos, lancamentosData, projetos, dashboard]);

  return {
    artistasMetrics,
    dashboardMetrics,
    // Exposed for whoever needs the raw list (e.g. Dashboard.tsx builds the
    // "upcoming appointments") without needing a second observer of
    // useEventos() just for that — same query, same cache, a single fetch.
    eventos,
    isLoading,
    error,
    refetch,
  };
}
