import { useState, useMemo, useRef } from "react";
import { fetchAllPages } from "@/shared/lib/exportAll";
import { statusLabelPtBr } from "@music-os-360/types";
import { readAgendaCell, toAgendaRow, type AgendaColumn } from "@/modules/events/lib/agenda-spreadsheet";
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
  normalizeScheduleParticipants,
  summarizeScheduleParticipants,
  useScheduleParticipants,
} from "@/modules/events/hooks/useScheduleParticipants";
import {
  buildGranularToBackendTypeMap,
  getBackendEventTypeLabel,
  normalizeToBackendType,
} from "@/modules/events/lib/event-type";
import { splitDateTime, combineDateTime } from "@/modules/events/lib/date-time";
import { readSpreadsheetRows } from "@/shared/lib/xlsx-isolated";
const getXLSX = () => import("xlsx");

type Event = Record<string, any>;

// events.status is the real value persisted by the backend — canonical English
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

// Chip color per status (same identity as the content calendar).
// Keys = real events.status (canonical English, see getStatusBadge above).
const STATUS_TONE: Record<string, string> = {
  confirmed: "border-emerald-300/40 bg-emerald-400/15 text-emerald-700",
  held: "border-sky-300/40 bg-sky-400/15 text-sky-700",
  completed: "border-sky-300/40 bg-sky-400/15 text-sky-700",
  planned: "border-amber-300/40 bg-amber-400/15 text-amber-700",
  scheduled: "border-amber-300/40 bg-amber-400/15 text-amber-700",
  cancelled: "border-rose-300/40 bg-rose-400/15 text-rose-700",
  postponed: "border-slate-300/40 bg-slate-400/15 text-slate-700",
};

const TYPE_OPTIONS = [
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

// value = real events.status sent as a filter to the backend (e.status = :status,
// see EventsService.baseQb) — it must match the canonical English value
// persisted in the column, not the pt-BR label shown to the user.
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

export default function Schedule() {
  const { events: rawEvents, isLoading: loadingUnbounded, deleteEvent, addEvent } = useEvents();
  const events = rawEvents as Event[];
  const { getOptionsByKind, getItemsByKind } = useOperationalSettings();
  const eventTypeOptions = getOptionsByKind("event_type");
  const typeOptions = useMemo(
    () => [{ value: "all-type", label: "Todos Tipos" }, ...(eventTypeOptions.length > 0 ? eventTypeOptions : TYPE_OPTIONS.slice(1))],
    [eventTypeOptions],
  );
  // events.type only stores the backend's coarse enum (show/festival/recording/
  // meeting/interview/tour/other) — the granular category chosen in the filter
  // (slug configured in Settings → Operational) must be translated
  // before becoming a query filter, otherwise it never matches a real event.
  const granularToBackendType = useMemo(
    () => buildGranularToBackendTypeMap(getItemsByKind("event_type")),
    [getItemsByKind],
  );
  const typeFilterBackendValue = (value: string) =>
    value === "all-type" ? undefined : normalizeToBackendType(value, granularToBackendType);
  const { getArtistParticipantById } = useScheduleParticipants();

  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; event?: Event }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; event?: Event }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; event?: Event }>({ open: false });
  const [viewMode, setViewMode] = useState<SchedulerViewMode>("semana");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all-type");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Bounds of the visible period (day/week/month/year) — the calendar fetches only
  // the events of that period (Task H: without it, the fetch was stuck at the
  // backend's default limit=50 and events silently disappeared in
  // any navigated month, in tenants with more than 50 events in total).
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
    const stored = normalizeScheduleParticipants(meta["participants"]);
    if (stored.length > 0) return stored;
    const artist = getArtistParticipantById(event.artist_id);
    return artist ? [artist] : [];
  }, [getArtistParticipantById]);

  const handleExcelExport = async () => {
    // Task I: full sweep via iterative server-side pagination —
    // it used to export only `events` (useEventos() without a filter, stuck at the
    // backend's default limit=50). Keeps the type/status filters
    // active on screen; it does not scope to the calendar period (export is "all
    // the events matching the filter", not "only what is visible now").
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
      const startParts = splitDateTime(e.starts_at);
      const endParts = splitDateTime(e.end_date);
      return toAgendaRow({
        title: e.title,
        type: getBackendEventTypeLabel(e.type),
        status: statusLabelPtBr("event", e.status) ?? "",
        participants: summarizeScheduleParticipants(getEventParticipants(e)),
        startDate: startParts.date,
        startTime: startParts.time,
        endDate: endParts.date,
        endTime: endParts.time,
        venue: e.venue || "",
        expectedAttendance: e.expected_attendance ?? "",
        feeAmount: e.fee_amount || "",
        description: e.description || "",
        notes: e.notes || "",
      });
    });

    const XLSX = await getXLSX();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Agenda");
    XLSX.writeFile(workbook, `agenda_${new Date().toISOString().split('T')[0]}.xlsx`);
    if (truncated) {
      toast.warning(`Exportação limitada a ${allEvents.length} evento(s) (volume muito grande) — refine os filtros para exportar o restante.`);
    } else {
      toast.success(`${allEvents.length} evento(s) exportado(s) com sucesso!`);
    }
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { rows } = await readSpreadsheetRows(await file.arrayBuffer());
      const data: Record<string, any>[] = rows;
      
      if (data.length === 0) {
        toast.error("Arquivo Excel vazio");
        return;
      }

      let importedCount = 0;
      for (const row of data) {
        const cell = (column: AgendaColumn) => readAgendaCell(row, column) as any;
        const title = cell("title");
        if (!title) continue;

        const startDate = cell("startDate") || new Date().toISOString().split("T")[0];
        const startTime = cell("startTime") || null;
        const endDate = cell("endDate") || null;
        const endTime = cell("endTime") || null;
        const rawType = String(cell("type") || "").toLowerCase();
        const feeValue = cell("feeAmount");
        const expectedAudience = cell("expectedAttendance");

        // Payload in the real CreateEventDto shape (title/type/startsAt/
        // endsAt/venue — not title/type/start_date, which do not exist in the DTO;
        // status is omitted because CreateEventDto does not accept it, only UpdateEventDto).
        const payload: Record<string, unknown> = {
          title,
          type: normalizeToBackendType(rawType, granularToBackendType),
        };
        const startsAt = combineDateTime(startDate, startTime);
        if (startsAt) payload.startsAt = startsAt;
        const endsAt = combineDateTime(endDate, endTime);
        if (endsAt) payload.endsAt = endsAt;
        if (cell("venue")) payload.venue = cell("venue");
        if (feeValue) payload.fee_amount = Number(feeValue);
        if (expectedAudience) payload.expected_attendance = Number(expectedAudience);
        if (cell("description")) payload.description = cell("description");
        if (cell("notes")) payload.notes = cell("notes");

        await addEvent.mutateAsync(payload as any);
        importedCount++;
      }

      toast.success(`${importedCount} evento(s) importado(s) com sucesso!`);
      if (excelInputRef.current) excelInputRef.current.value = "";
    } catch {
      toast.error("Erro ao importar arquivo Excel");
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  // Type/status already applied server-side in useEventosScoped(); the text
  // search stays client-side over the already-scoped period (title, venue AND
  // participant name — the backend does not index participant names).
  const filteredEvents = useMemo(() => {
    if (!searchTerm) return scopedEvents;
    const term = searchTerm.toLowerCase();
    return scopedEvents.filter((event) =>
      event.title?.toLowerCase().includes(term) ||
      event.venue?.toLowerCase().includes(term) ||
      summarizeScheduleParticipants(getEventParticipants(event)).toLowerCase().includes(term),
    );
  }, [scopedEvents, searchTerm, getEventParticipants]);

  const schedulerEvents = useMemo(() => filteredEvents.map((event) => {
    // events.starts_at/end_date are the real date+time fields (starts_at is
    // NOT NULL, always present) — start_date/horario_inicio/horario_fim
    // never existed in the backend, so that read always fell into the fallback
    // "now" and every event showed on the wrong date in the calendar.
    const start = event.starts_at ? new Date(event.starts_at) : new Date();
    const end = event.end_date ? new Date(event.end_date) : undefined;
    const isMidnight = start.getHours() === 0 && start.getMinutes() === 0;

    return {
      id: event.id,
      title: event.title ?? "Evento",
      artist: summarizeScheduleParticipants(getEventParticipants(event)) || undefined,
      startDate: start,
      endDate: end,
      location: event.venue,
      status: event.status ?? "scheduled",
      cache: event.fee_amount ?? undefined,
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

      {/* Outside the isLoading gate on purpose — same bug as /artists
          (Task C): SchedulerFormModal calls useEventos() again only for
          the mutations, the same query as the isLoading above. */}
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
