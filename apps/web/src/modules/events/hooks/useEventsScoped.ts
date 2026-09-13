import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { usePaginatedDataQuery } from "@/shared/hooks/usePaginatedDataQuery";
import { api } from "@/shared/lib/api-client";
import type { EventWithRelations } from "./useEvents";

export interface UseEventsScopedParams {
  /** ISO date-time bounds do período visível no calendário (dia/semana/mês/ano). */
  dateFrom: string;
  dateTo: string;
  search?: string;
  type?: string;
  status?: string;
}

/**
 * Eventos do período do calendário atualmente visível — nunca a tabela
 * inteira. `useEventos()` sem filtros ficava presa ao default do backend
 * (limit=50, ver PaginationDto), então tenants com mais de 50 eventos no
 * total perdiam eventos silenciosamente em qualquer mês/semana navegado.
 * Escopar por dateFrom/dateTo (coluna real `data`) resolve isso: cada
 * período tem, na prática, muito menos de 200 eventos.
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

/** GET /events/stats — KPIs exatos do tenant inteiro, independentes do período do calendário. */
export function useEventsStats() {
  const query = useQuery<StatsResponse>({
    queryKey: [...QUERY_KEYS.EVENTS, "stats"],
    queryFn: ({ signal }) => api.get<StatsResponse>("/events/stats", { signal }),
    staleTime: 30_000,
  });

  const data = query.data;
  // byGroup agrupa por events.status real — valor canônico em inglês (ver
  // @music-os-360/types EventStatus / EventsService.stats()), não pt-BR.
  const kpis: EventsKPIs = !data ? EMPTY_KPIS : {
    total: data.total,
    confirmed: data.byGroup["confirmed"] ?? 0,
    pending: (data.byGroup["planned"] ?? 0) + (data.byGroup["scheduled"] ?? 0),
    upcoming7Days: data.upcoming7Days,
  };

  return { kpis, isLoading: query.isLoading, error: query.error };
}
