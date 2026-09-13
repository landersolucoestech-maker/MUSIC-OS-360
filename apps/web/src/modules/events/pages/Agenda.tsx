import { useState, useMemo, useRef } from "react";
import { fetchAllPages } from "@/shared/lib/exportAll";
import { endOfWeek, endOfMonth, endOfYear, startOfDay, endOfDay, format, startOfMonth, startOfWeek, startOfYear, subWeeks, addWeeks, addMonths, subMonths, addYears, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/shared/components/MainLayout";
import { Card, CardContent } from "@/shared/ui/card";
import { MetricCard } from "@/shared/components/MetricCard";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";
import { Calendar, Plus, Loader2, Eye, Pencil, Trash2, CalendarDays, CheckCircle2, Clock, CalendarClock, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { useEvents } from "@/modules/events/hooks/useEvents";
import { useEventsScoped, useEventsStats } from "@/modules/events/hooks/useEventsScoped";
import { formatDate, formatCurrency } from "@/shared/lib/format-utils";
import { SchedulerFormModal } from "@/modules/events/components/SchedulerFormModal";
import { SchedulerViewModal } from "@/modules/events/components/SchedulerViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { toast } from "sonner";
import { EntityCalendarView, type CalendarEvent } from "@/shared/components/EntityCalendarView";
import type { SchedulerViewMode } from "@/modules/events/components/types";
import { useOperationalSettings } from "@/modules/settings/hooks/useOperationalSettings";
import {
  normalizeAgendaParticipants,
  summarizeAgendaParticipants,
  useAgendaParticipants,
} from "@/modules/events/hooks/useAgendaParticipants";
import {
  buildGranularToBackendTypeMap,
  getBackendEventTypeLabel,
  normalizeToBackendType,
} from "@/modules/events/lib/event-type";
import { splitDateTime, combineDateTime } from "@/modules/events/lib/date-time";
const getXLSX = () => import("xlsx");

type Event = Record<string, any>;

// events.status é o valor real persistido pelo backend — canônico em inglês
// (EventStatus de @music-os-360/types: planned/scheduled/confirmed/held/
// completed/cancelled/postponed). Ver docs/NAMING_NORMALIZATION_CANONICAL_MAP.md.
const getStatusBadge = (status: string) => {
  switch (status) {
    case "confirmed": return <Badge variant="success">Confirmado</Badge>;
    case "planned":
    case "scheduled": return <Badge variant="warning">Pendente</Badge>;
    case "held":
    case "completed": return <Badge variant="info">Realizado</Badge>;
    case "cancelled": return <Badge variant="danger">Cancelado</Badge>;
    case "postponed": return <Badge variant="neutral">Adiado</Badge>;
    default: return <Badge variant="neutral">{status?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Badge>;
  }
};

const VIEW_OPTIONS: { value: SchedulerViewMode; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

// Cor do chip por status (mesma identidade do calendário de conteúdo).
// Chaves = events.status real (canônico em inglês, ver getStatusBadge acima).
const STATUS_TONE: Record<string, string> = {
  confirmed: "border-emerald-300/40 bg-emerald-400/15 text-emerald-700",
  held: "border-sky-300/40 bg-sky-400/15 text-sky-700",
  completed: "border-sky-300/40 bg-sky-400/15 text-sky-700",
  planned: "border-amber-300/40 bg-amber-400/15 text-amber-700",
  scheduled: "border-amber-300/40 bg-amber-400/15 text-amber-700",
  cancelled: "border-rose-300/40 bg-rose-400/15 text-rose-700",
  postponed: "border-slate-300/40 bg-slate-400/15 text-slate-700",
};

const TIPO_OPTIONS = [
  { value: "all-type", label: "Todos Tipos" },
  { value: "shows", label: "Shows" },
  { value: "sessoes_estudio", label: "Sessões de Estúdio" },
  { value: "ensaios", label: "Ensaios" },
  { value: "sessoes_fotos", label: "Sessões de Fotos" },
  { value: "entrevistas", label: "Entrevistas" },
  { value: "podcasts", label: "Podcasts" },
  { value: "programas_tv", label: "Programas de TV" },
  { value: "radio", label: "Rádio" },
  { value: "producao_conteudo", label: "Produção de Conteúdo" },
  { value: "reunioes", label: "Reuniões" },
];

// value = events.status real enviado como filtro ao backend (e.status = :status,
// ver EventsService.baseQb) — precisa bater com o valor canônico em inglês
// persistido na coluna, não com o rótulo pt-BR exibido ao usuário.
const STATUS_OPTIONS = [
  { value: "all-status", label: "Todos Status" },
  { value: "confirmed", label: "Confirmado", dot: "bg-emerald-400" },
  { value: "scheduled", label: "Agendado", dot: "bg-amber-400" },
  { value: "held", label: "Realizado", dot: "bg-sky-400" },
  { value: "cancelled", label: "Cancelado", dot: "bg-rose-500" },
  { value: "postponed", label: "Adiado", dot: "bg-slate-400" },
];

function ToolbarSelect({
  value,
  onValueChange,
  options,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function Agenda() {
  const { events: rawEvents, isLoading: loadingUnbounded, deleteEvent, addEvent } = useEvents();
  const events = rawEvents as Event[];
  const { getOptionsByKind, getItemsByKind } = useOperationalSettings();
  const eventTypeOptions = getOptionsByKind("event_type");
  const typeOptions = useMemo(
    () => [{ value: "all-type", label: "Todos Tipos" }, ...(eventTypeOptions.length > 0 ? eventTypeOptions : TIPO_OPTIONS.slice(1))],
    [eventTypeOptions],
  );
  // events.type só guarda o enum coarse do backend (show/festival/recording/
  // meeting/interview/tour/other) — a categoria granular escolhida no filtro
  // (slug configurado em Configurações → Operacional) precisa ser traduzida
  // antes de virar filtro de query, senão nunca bate com nenhum evento real.
  const granularToBackendType = useMemo(
    () => buildGranularToBackendTypeMap(getItemsByKind("event_type")),
    [getItemsByKind],
  );
  const typeFilterBackendValue = (value: string) =>
    value === "all-type" ? undefined : normalizeToBackendType(value, granularToBackendType);
  const { getArtistParticipantById } = useAgendaParticipants();

  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; event?: Event }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; event?: Event }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; event?: Event }>({ open: false });
  const [viewMode, setViewMode] = useState<SchedulerViewMode>("semana");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all-type");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Bounds do período visível (dia/semana/mês/ano) — o calendário busca só
  // os events desse período (Task H: sem isso, o fetch ficava preso ao
  // limit=50 default do backend e sumia events silenciosamente em
  // qualquer mês navegado, em tenants com mais de 50 events no total).
  const { periodStart, periodEnd } = useMemo(() => {
    if (viewMode === "dia") return { periodStart: startOfDay(currentDate), periodEnd: endOfDay(currentDate) };
    if (viewMode === "mes") return { periodStart: startOfMonth(currentDate), periodEnd: endOfMonth(currentDate) };
    if (viewMode === "ano") return { periodStart: startOfYear(currentDate), periodEnd: endOfYear(currentDate) };
    return { periodStart: startOfWeek(currentDate, { weekStartsOn: 1 }), periodEnd: endOfWeek(currentDate, { weekStartsOn: 1 }) };
  }, [viewMode, currentDate]);

  const {
    events: scopedEventsRaw, isLoading: isLoadingScoped, error: scopedError, refetch: refetchScoped,
  } = useEventsScoped({
    dateFrom: periodStart.toISOString(),
    dateTo: periodEnd.toISOString(),
    type: typeFilterBackendValue(typeFilter),
    status: statusFilter !== "all-status" ? statusFilter : undefined,
  });
  const scopedEvents = scopedEventsRaw as Event[];

  const { kpis: metrics } = useEventsStats();

  const getEventParticipants = useMemo(() => (event: Event) => {
    const meta = (event.metadata as Record<string, unknown> | undefined) ?? {};
    const stored = normalizeAgendaParticipants(meta["participants"]);
    if (stored.length > 0) return stored;
    const artist = getArtistParticipantById(event.artist_id);
    return artist ? [artist] : [];
  }, [getArtistParticipantById]);

  const handleExcelExport = async () => {
    // Task I: varredura completa via paginação iterativa server-side —
    // antes exportava só `events` (useEventos() sem filtro, preso ao
    // limit=50 default do backend). Preserva os filtros de type/status
    // ativos na tela; não escopa ao período do calendário (export é "todos
    // os events que casam com o filtro", não "só o que está visível agora").
    const filters: Record<string, unknown> = {};
    const backendType = typeFilterBackendValue(typeFilter);
    if (backendType) filters.type = backendType;
    if (statusFilter !== "all-status") filters.status = statusFilter;

    const { items: allEvents, truncated } = await fetchAllPages<Event>("events", { filters });

    if (allEvents.length === 0) {
      toast.error("Nenhum evento para exportar");
      return;
    }

    const exportData = allEvents.map(e => {
      const inicio = splitDateTime(e.data);
      const fim = splitDateTime(e.end_date);
      return {
        title: e.title,
        type: getBackendEventTypeLabel(e.type),
        status: e.status,
        participantes: summarizeAgendaParticipants(getEventParticipants(e)),
        start_date: inicio.date,
        horario_inicio: inicio.time,
        end_date: fim.date,
        horario_fim: fim.time,
        local: e.local || "",
        publico_esperado: e.publico_esperado ?? "",
        valor_cache: e.valor_cache || "",
        descricao: e.descricao || "",
        observacoes: e.observacoes || "",
      };
    });

    const XLSX = await getXLSX();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Agenda");
    XLSX.writeFile(workbook, `agenda_${new Date().toISOString().split('T')[0]}.xlsx`);
    if (truncated) {
      toast.warning(`Exportação limitada a ${allEvents.length} evento(s) (tenant muito grande) — refine os filtros para exportar o restante.`);
    } else {
      toast.success(`${allEvents.length} evento(s) exportado(s) com sucesso!`);
    }
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await getXLSX();
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);
      
      if (data.length === 0) {
        toast.error("Arquivo Excel vazio");
        return;
      }

      let importados = 0;
      for (const row of data) {
        const title = row.title || row.Title || row.TITULO || row.Título;
        if (!title) continue;

        const startDate = row.start_date || row.data || row.Data || new Date().toISOString().split("T")[0];
        const horarioInicio = row.horario_inicio || row.horario || row.Horario || null;
        const endDate = row.end_date || row["Data Fim"] || null;
        const horarioFim = row.horario_fim || row["Horário Fim"] || null;
        const tipoRaw = String(row.tipo_evento || row.type || row.Tipo || "").toLowerCase();
        const valorCache = row.valor_cache || row["Valor Cachê"];
        const publicoEsperado = row.publico_esperado || row["Público Esperado"] || row.capacidade || row["Capacidade"];

        // Payload no formato do CreateEventDto real (title/type/startsAt/
        // endsAt/venue — não title/type/start_date, que não existem no DTO;
        // status é omitido pois CreateEventDto não o aceita, só UpdateEventDto).
        const payload: Record<string, unknown> = {
          title: title,
          type: normalizeToBackendType(tipoRaw, granularToBackendType),
        };
        const startsAt = combineDateTime(startDate, horarioInicio);
        if (startsAt) payload.startsAt = startsAt;
        const endsAt = combineDateTime(endDate, horarioFim);
        if (endsAt) payload.endsAt = endsAt;
        if (row.local || row.Local) payload.venue = row.local || row.Local;
        if (valorCache) payload.valor_cache = Number(valorCache);
        if (publicoEsperado) payload.publico_esperado = Number(publicoEsperado);
        if (row.descricao || row.Descrição) payload.descricao = row.descricao || row.Descrição;
        if (row.observacoes || row.Observações) payload.observacoes = row.observacoes || row.Observações;

        await addEvent.mutateAsync(payload as any);
        importados++;
      }

      toast.success(`${importados} evento(s) importado(s) com sucesso!`);
      if (excelInputRef.current) excelInputRef.current.value = "";
    } catch {
      toast.error("Erro ao importar arquivo Excel");
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  // Tipo/status já aplicados server-side em useEventosScoped(); a busca por
  // texto continua client-side sobre o período já escopado (título, local E
  // nome de participante — o backend não indexa nome de participante).
  const filteredEvents = useMemo(() => {
    if (!searchTerm) return scopedEvents;
    const term = searchTerm.toLowerCase();
    return scopedEvents.filter((event) =>
      event.title?.toLowerCase().includes(term) ||
      event.local?.toLowerCase().includes(term) ||
      summarizeAgendaParticipants(getEventParticipants(event)).toLowerCase().includes(term),
    );
  }, [scopedEvents, searchTerm, getEventParticipants]);

  const schedulerEvents = useMemo(() => filteredEvents.map((event) => {
    // events.data/end_date são os únicos campos reais de data+hora (coluna
    // NOT NULL, sempre presente) — start_date/horario_inicio/horario_fim
    // nunca existiram no backend, então essa leitura sempre caía no fallback
    // "agora" e todo evento aparecia na data errada no calendário.
    const start = event.data ? new Date(event.data) : new Date();
    const end = event.end_date ? new Date(event.end_date) : undefined;
    const isMidnight = start.getHours() === 0 && start.getMinutes() === 0;

    return {
      id: event.id,
      title: event.title ?? "Evento",
      artist: summarizeAgendaParticipants(getEventParticipants(event)) || undefined,
      startDate: start,
      endDate: end,
      location: event.local,
      status: event.status ?? "scheduled",
      cache: event.valor_cache ?? undefined,
      type: getBackendEventTypeLabel(event.type),
      allDay: isMidnight,
      raw: event,
    };
  }), [filteredEvents, getEventParticipants]);

  const isoFromDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const calendarEvents: CalendarEvent[] = useMemo(() => schedulerEvents.map((e) => ({
    id: e.id,
    title: e.title,
    dateISO: isoFromDate(e.startDate),
    time: e.allDay ? null : `${String(e.startDate.getHours()).padStart(2, "0")}:${String(e.startDate.getMinutes()).padStart(2, "0")}`,
    toneClass: STATUS_TONE[String(e.status)] ?? undefined,
    hint: e.artist ? `${e.title} · ${e.artist}` : e.title,
  })), [schedulerEvents]);

  const openEventView = (id: string) => {
    const event = scopedEvents.find((ev) => ev.id === id);
    if (event) setViewModal({ open: true, event });
  };

  const periodLabel = useMemo(() => {
    if (viewMode === "semana") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "d", { locale: ptBR })} — ${format(end, "d 'de' MMMM, yyyy", { locale: ptBR })}`;
    }
    if (viewMode === "mes") {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
    if (viewMode === "ano") {
      return format(currentDate, "yyyy", { locale: ptBR });
    }
    return format(currentDate, "d 'de' MMMM yyyy", { locale: ptBR });
  }, [currentDate, viewMode]);

  const goToToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    if (viewMode === "semana") setCurrentDate((date) => subWeeks(date, 1));
    if (viewMode === "mes") setCurrentDate((date) => subMonths(date, 1));
    if (viewMode === "ano") setCurrentDate((date) => subYears(date, 1));
  };
  const goNext = () => {
    if (viewMode === "semana") setCurrentDate((date) => addWeeks(date, 1));
    if (viewMode === "mes") setCurrentDate((date) => addMonths(date, 1));
    if (viewMode === "ano") setCurrentDate((date) => addYears(date, 1));
  };

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "all-type" || statusFilter !== "all-status";

  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all-type");
    setStatusFilter("all-status");
  };

  const handleDelete = () => {
    if (deleteModal.event) {
      deleteEvent.mutate(deleteModal.event.id);
      setDeleteModal({ open: false });
    }
  };

  const createButton = (
    <RequirePermission module="events" action="write">
      <Button size="sm" className="gap-2 bg-primary" onClick={() => setFormModal({ open: true, mode: "create" })}>
        <Plus className="h-4 w-4" />Novo Evento
      </Button>
    </RequirePermission>
  );

  return (
    <FeatureGate feature="moduleEvents" featureName="Agenda & Eventos">
    <>
    {loadingUnbounded || isLoadingScoped ? (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
      <MainLayout title="Agenda" description="Gerencie shows, turnês e compromissos com foco operacional" actions={createButton}>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Eventos" value={metrics.total} description="no total" icon={CalendarDays} accent="primary" />
            <MetricCard title="Confirmados" value={metrics.confirmed} description="eventos confirmados" icon={CheckCircle2} accent="success" />
            <MetricCard title="Pendentes" value={metrics.pending} description="aguardando confirmação" icon={Clock} accent="warning" />
            <MetricCard title="Próximos 7 dias" value={metrics.upcoming7Days} description="na próxima semana" icon={CalendarClock} accent="primary" />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 p-3">
            <Button variant="outline" size="sm" className="h-8 px-3" onClick={goToToday}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev} aria-label="Período anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext} aria-label="Próximo período">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="min-w-[132px] px-1 text-sm font-medium text-muted-foreground">{periodLabel}</span>

            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar evento..."
                className="h-8 pl-9"
              />
            </div>

            <ToolbarSelect
              value={viewMode}
              onValueChange={(value) => setViewMode(value as SchedulerViewMode)}
              options={VIEW_OPTIONS}
              className="w-[100px]"
            />
            <ToolbarSelect
              value={typeFilter}
              onValueChange={setTypeFilter}
              options={typeOptions}
              className="w-[132px]"
            />
            <ToolbarSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={STATUS_OPTIONS}
              className="w-[132px]"
            />
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {filteredEvents.length === 0 ? (
              scopedError && scopedEvents.length === 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <UnavailableState onRetry={() => refetchScoped()} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum evento encontrado</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setFormModal({ open: true, mode: "create" })}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar primeiro evento
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <EntityCalendarView
                view={(viewMode === "dia" || viewMode === "semana" || viewMode === "mes" || viewMode === "ano") ? viewMode : "mes"}
                referenceDate={currentDate}
                events={calendarEvents}
                onSelect={openEventView}
              />
            )}
          </div>
        </div>
      </MainLayout>
    )}

      {/* Fora do gate de isLoading de propósito — mesmo bug de /artistas
          (Task C): SchedulerFormModal chama useEventos() de novo só para
          as mutations, a mesma query do isLoading acima. */}
      <SchedulerViewModal
        open={viewModal.open}
        onOpenChange={(open) => setViewModal({ ...viewModal, open })}
        event={viewModal.event as any}
        onEdit={() => {
          setViewModal({ open: false });
          setFormModal({ open: true, mode: "edit", event: viewModal.event });
        }}
      />
      <SchedulerFormModal
        open={formModal.open}
        onOpenChange={(open) => setFormModal({ ...formModal, open })}
        event={formModal.event as any}
        mode={formModal.mode}
      />
      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        title="Excluir Evento"
        description={`Tem certeza que deseja excluir "${deleteModal.event?.title}"?`}
        onConfirm={handleDelete}
      />
    </>
    </FeatureGate>
  );
}
