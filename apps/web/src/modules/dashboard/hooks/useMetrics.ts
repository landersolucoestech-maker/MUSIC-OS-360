/**
 * modules/dashboard/hooks/useMetrics.ts
 *
 * Hook agregador de métricas cross-módulo para o Dashboard.
 * Pertence ao módulo dashboard — NÃO é shared, pois importa directamente
 * de módulos de domínio. Shared nunca importa de módulos.
 *
 * Task G: contagens/somas (totalArtistas, contratosAtivos, contratosVencendo,
 * receitaMensal) agora vêm de useOperationalDashboard() — GET /analytics/dashboard,
 * que já calcula tudo via COUNT/SUM no banco (ver AnalyticsService.getDashboard) —
 * em vez de baixar as tabelas inteiras de contratos/transações/clientes só para
 * somar no cliente. Só continuam sendo buscadas as listas cujos REGISTROS (não
 * agregados) são exibidos: artistas e eventos (para "destaques" e "próximos
 * compromissos"), lançamentos/projetos (para contar por artista nos destaques).
 */
import { useMemo } from "react";
import { useArtists } from "@/modules/artist/hooks/useArtists";
import { useEvents, type EventWithRelations } from "@/modules/events/hooks/useEvents";
import { useLancamentos } from "@/modules/releases/hooks/useLancamentos";
import { useProjects } from "@/modules/projects/hooks/useProjects";
import { useOperationalDashboard } from "./useOperationalDashboard";
import { isToday, startOfMonth, endOfMonth, parseISO } from "date-fns";

interface ArtistaDestaque {
  id: string;
  stageName: string;
  musicGenre: string | null;
  lancamentos: number;
  /** null = dado de streams ainda não integrado (não exibir como 0). */
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
  const { lancamentos: lancamentosData, isLoading: loadingLancamentos, error: errLancamentos, refetch: refetchLancamentos } = useLancamentos();
  const { projects: projetos, isLoading: loadingProjetos, error: errProjetos, refetch: refetchProjetos } = useProjects();
  const { dashboard, isLoading: loadingAgg, error: errAgg, refetch: refetchAgg } = useOperationalDashboard();

  const refetch = () => {
    refetchArtistas(); refetchEventos(); refetchLancamentos(); refetchProjetos(); refetchAgg();
  };

  // Nenhuma das 5 fontes carregou com sucesso: KPIs zerados nesse caso são
  // indisponibilidade, não dado real — Dashboard.tsx usa isto para decidir
  // entre mostrar os KPIs ou um banner de "não foi possível carregar".
  const error = (errArtistas || errEventos || errLancamentos || errProjetos || errAgg) &&
    artistas.length === 0 && eventos.length === 0 && lancamentosData.length === 0 &&
    projetos.length === 0 && !dashboard
    ? (errArtistas || errEventos || errLancamentos || errProjetos || errAgg)
    : null;
  const isLoading = loadingArtistas || loadingEventos || loadingLancamentos || loadingProjetos || loadingAgg;

  const artistasMetrics = useMemo<ArtistasMetrics>(() => {
    // Task J: contrato_id/status são regra de negócio 1:1 no backend (artist
    // só entra em status "signed" com contrato_id preenchido — ver
    // ArtistsService.changeStatus) — por isso `artists_by_status.signed`
    // do agregado GET /analytics/dashboard (COUNT real no banco, nunca
    // capado) cobre exatamente "artistas com contrato ativo", sem precisar
    // de endpoint novo. Cai para o array capado (artistas.length) só se o
    // agregado ainda não carregou — mesmo padrão de fallback do totalArtistas.
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
      .reduce((acc, e) => acc + ((e as Record<string, unknown>)["valor_cache"] as number || 0), 0);

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

    // Backend retorna timestamp na coluna `data`; mock usa `start_date`.
    // Aceita os dois para evitar contagem zerada em HTTP mode.
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

      // Streams: tenta múltiplas fontes; se nenhuma disponível, retorna null
      // para a UI poder exibir "–" em vez de "0" falso.
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
    // Exposto para quem precisa da lista bruta (ex.: Dashboard.tsx monta os
    // "próximos compromissos") sem precisar de um segundo observer de
    // useEventos() só para isso — mesma query, mesmo cache, um único fetch.
    eventos,
    isLoading,
    error,
    refetch,
  };
}
