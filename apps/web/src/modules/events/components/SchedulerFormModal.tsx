import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { eventSchema } from "@/modules/events/lib/event-schema";
import { legacyTitle } from "@/shared/lib/legacy-title";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Textarea } from "@/shared/ui/textarea";
import { FormField, FormTextarea, FieldError } from "@/shared/components/FormField";
import { toast } from "sonner";
import { Clock, Search } from "lucide-react";
import { format, parse, parseISO, isValid } from "date-fns";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { useEvents } from "@/modules/events/hooks/useEvents";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import {
  agendaParticipantKey,
  normalizeAgendaParticipants,
  summarizeAgendaParticipants,
  useAgendaParticipants,
  type AgendaParticipant,
} from "@/modules/events/hooks/useAgendaParticipants";
import { useOperationalSettings } from "@/modules/settings/hooks/useOperationalSettings";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { buildGranularToBackendTypeMap, normalizeToBackendType } from "@/modules/events/lib/event-type";

interface SchedulerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: any;
  mode: "create" | "edit" | "view";
}

/** Raw shape of GET /clients (ClientsService.mapClient) — used for the
 * CRM venue (company contacts), without depending on the `Cliente` view-model. */
interface LocalCRMLookup {
  id: string;
  nome: string;
  phone?: string | null;
  endereco_completo?: string | null;
  city?: string | null;
  state?: string | null;
}

const eventTypes = [
  { value: "sessoes_estudio", label: "Sessões de estúdio" },
  { value: "ensaios", label: "Ensaios" },
  { value: "sessoes_fotos", label: "Sessões de fotos" },
  { value: "shows", label: "Shows" },
  { value: "entrevistas", label: "Entrevistas" },
  { value: "podcasts", label: "Podcasts" },
  { value: "programas_tv", label: "Programas de TV" },
  { value: "radio", label: "Rádio" },
  { value: "producao_conteudo", label: "Produção de conteúdo" },
  { value: "reunioes", label: "Reuniões" },
];

const statusOptions = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "pendente", label: "Pendente" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];


const artistRelatedTypes = [
  "sessoes_estudio",
  "ensaios",
  "sessoes_fotos",
  "shows",
  "entrevistas",
  "podcasts",
  "programas_tv",
  "radio",
  "producao_conteudo",
];

// Event types that should pull the venue from the CRM
const venueTypesCrm = ["shows", "programas_tv", "radio", "podcasts"];

const eventTypeAliases: Record<string, string> = {
  show: "shows",
  show_teatro: "shows",
  festival: "shows",
  rodeio: "shows",
  lancamento: "shows",
  evento_corporativo: "shows",
  reuniao: "reunioes",
  reunioes: "reunioes",
  // Persisted events only keep the backend's coarse enum (events.type,
  // without the original granular category) — when editing, the select must
  // resolve those values to a representative granular category instead
  // of staying blank.
  recording: "sessoes_estudio",
  meeting: "reunioes",
  interview: "entrevistas",
  tour: "shows",
};

const statusAliases: Record<string, string> = {
  realizado: "concluido",
  concluido: "concluido",
  negociacao: "pendente",
  // The real events.status from the backend is canonical English (EventStatus from
  // @music-os-360/types) — without this, editing an existing event matched
  // no Select option (it stayed blank).
  scheduled: "agendado",
  planned: "agendado",
  confirmed: "confirmado",
  held: "concluido",
  completed: "concluido",
  cancelled: "cancelado",
};

const normalizeSelectValue = (value: unknown, aliases: Record<string, string>) => {
  if (typeof value !== "string") return "";
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return aliases[normalized] ?? normalized;
};

const normalizeEventDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return isValid(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const isoParsed = parseISO(trimmed);
  if (isValid(isoParsed)) return isoParsed;

  const brParsed = parse(trimmed, "dd/MM/yyyy", new Date());
  return isValid(brParsed) ? brParsed : undefined;
};

const normalizeTimeValue = (value: unknown): string => {
  if (value instanceof Date && isValid(value)) return format(value, "HH:mm");
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  const twelveHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const period = twelveHourMatch[3].toUpperCase();

    if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  return "";
};

const getInitialFormData = (event?: any) => {
  // The HTTP backend returns entity columns: type, data, local. Metadata stores
  // descricao, observacoes, valor_cache, etc. Accepts every format.
  const meta = (event?.metadata as Record<string, unknown> | undefined) ?? {};
  return {
    title: (legacyTitle(event) as string | undefined) || "",
    tipoEvento: normalizeSelectValue(
      event?.tipoEvento || event?.tipo_evento || event?.tipo || event?.type,
      eventTypeAliases,
    ),
    artista: event?.artista || event?.artist_id || event?.artistId || "",
    participantes: normalizeAgendaParticipants(event?.participantes ?? meta["participants"]),
    status: normalizeSelectValue(event?.status, statusAliases) || "agendado",
    startDate: normalizeEventDate(
      event?.startDate || event?.start_date || event?.data || event?.startsAt,
    ),
    horarioInicio: normalizeTimeValue(event?.horarioInicio || event?.horario_inicio),
    endDate: normalizeEventDate(
      event?.endDate || event?.end_date || event?.endsAt,
    ),
    horarioFim: normalizeTimeValue(event?.horarioFim || event?.horario_fim),
    nomeLocal: event?.nomeLocal || event?.local || event?.venue || "",
    endereco: event?.endereco || (meta["endereco"] as string) || "",
    contatoLocal: event?.contatoLocal || event?.contato_local || (meta["contato_local"] as string) || "",
    capacidadePublico:
      event?.capacidadePublico ||
      event?.capacidade_publico ||
      event?.capacity ||
      "",
    valorCache: event?.fee_amount || event?.valorCache || event?.valor_cache || (meta["valor_cache"] as string | number) || "",
    publicoEsperado:
      event?.publicoEsperado ||
      event?.publico_esperado ||
      (meta["publico_esperado"] as string | number) ||
      "",
    descricao: event?.description || (meta["descricao"] as string) || "",
    observacoes: event?.notes || (meta["observacoes"] as string) || "",
  };
};

type SchedulerFormData = ReturnType<typeof getInitialFormData>;

const validationFieldLabels: Record<string, string> = {
  title: "Título do Evento",
  tipoEvento: "Tipo de Evento",
  startDate: "Data de Início",
  horarioInicio: "Horário de Início",
  endDate: "Data de Fim",
  horarioFim: "Horário de Fim",
  nomeLocal: "Nome do Local",
  endereco: "Endereço Completo",
  contatoLocal: "Contato do Local",
};

export function SchedulerFormModal({ open, onOpenChange, event, mode }: SchedulerFormModalProps) {
  const queryClient = useQueryClient();
  const { getOptionsByKind, getItemsByKind } = useOperationalSettings();
  const operationalEventTypeOptions = getOptionsByKind("event_type");
  const eventTypeOptions = operationalEventTypeOptions.length > 0 ? operationalEventTypeOptions : eventTypes;
  // events.type only keeps the backend's coarse enum — each granular category
  // configured in Settings → Operational carries the mapping in
  // metadata.backend_type (ver lib/event-type.ts).
  const granularToBackendType = buildGranularToBackendTypeMap(getItemsByKind("event_type"));
  const [participantSearch, setParticipantSearch] = useState("");
  const legacyArtistId = event?.artista || event?.artist_id || event?.artistId || null;
  const { participants, getParticipantByKey, getArtistParticipantById, pendingArtist } = useAgendaParticipants(participantSearch, legacyArtistId);

  const hydrateFormData = (currentEvent?: any) => {
    const initial = getInitialFormData(currentEvent);
    if (initial.participantes.length === 0 && initial.artista) {
      const artistParticipant = getArtistParticipantById(initial.artista);
      if (artistParticipant) {
        return { ...initial, participantes: [artistParticipant] };
      }
    }
    return initial;
  };

  const [formData, setFormData] = useState(hydrateFormData(event));

  const { addEvent, updateEvent } = useEvents();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(hydrateFormData(open ? event : undefined));
    setErrors({});
    // `pendingArtist` (not `participants`) on purpose: `participants` changes on
    // every search typed in the participant picker, which would reset the
    // whole form while the user types. `pendingArtist` only changes
    // when the event's legacy artist (`artista` field) finishes resolving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, mode, open, pendingArtist]);

  const isViewMode = mode === "view";
  const title = mode === "create" ? "Novo Evento na Agenda" : mode === "edit" ? "Editar Evento" : "Visualizar Evento";

  // Check whether the event type is artist-related
  const isArtistRelated = artistRelatedTypes.includes(formData.tipoEvento);
  
  // Show the venue fields when artist-related OR a meeting
  const showLocalFields = isArtistRelated || formData.tipoEvento === "reunioes";
  
  // Show the show-only fields
  const isShow = formData.tipoEvento === "shows";
  
  // Check whether the event type should pull the venue from the CRM
  const shouldUseCRMLocal = venueTypesCrm.includes(formData.tipoEvento);
  const selectedParticipantKeys = formData.participantes.map(agendaParticipantKey);
  const selectedParticipantsSummary = summarizeAgendaParticipants(formData.participantes);

  const updateParticipants = (nextParticipants: AgendaParticipant[]) => {
    const firstArtist = nextParticipants.find((participant) => participant.source === "artist");
    setFormData({
      ...formData,
      participantes: nextParticipants,
      artista: firstArtist?.id ?? "",
    });
  };

  const handleParticipantToggle = (key: string) => {
    const isSelected = selectedParticipantKeys.includes(key);
    if (isSelected) {
      updateParticipants(formData.participantes.filter((participant) => agendaParticipantKey(participant) !== key));
      return;
    }
    const participant = getParticipantByKey(key);
    if (participant) updateParticipants([...formData.participantes, participant]);
  };

  // Update contact data when a CRM venue is selected
  const handleLocalCRMChange = (localId: string, local?: LocalCRMLookup) => {
    if (local) {
      setFormData({
        ...formData,
        nomeLocal: localId,
        contatoLocal: local.phone || "",
        endereco: [local.endereco_completo, local.city, local.state].filter(Boolean).join(", ")
      });
    } else {
      setFormData({ ...formData, nomeLocal: localId });
    }
  };

  const normalizeDate = (value: Date | string | undefined | null): Date | undefined => {
    return normalizeEventDate(value);
  };

  const getNormalizedFormData = (): SchedulerFormData => ({
    ...formData,
    title: String(formData.title || event?.title || event?.titulo || "").trim(),
    tipoEvento: normalizeSelectValue(formData.tipoEvento || event?.tipoEvento || event?.tipo_evento || event?.tipo, eventTypeAliases),
    status: normalizeSelectValue(formData.status || event?.status, statusAliases) || "agendado",
    startDate: normalizeDate(formData.startDate) ?? normalizeEventDate(event?.startDate || event?.start_date || event?.data),
    endDate: normalizeDate(formData.endDate) ?? normalizeEventDate(event?.endDate || event?.end_date),
    horarioInicio: normalizeTimeValue(formData.horarioInicio || event?.horarioInicio || event?.horario_inicio),
    horarioFim: normalizeTimeValue(formData.horarioFim || event?.horarioFim || event?.horario_fim),
  });

  const validate = (): SchedulerFormData | null => {
    const normalizedFormData = getNormalizedFormData();

    const result = eventSchema.safeParse({
      title: normalizedFormData.title,
      tipoEvento: normalizedFormData.tipoEvento,
      artista: normalizedFormData.artista,
      status: normalizedFormData.status,
      startDate: normalizedFormData.startDate,
      horarioInicio: normalizedFormData.horarioInicio,
      endDate: normalizedFormData.endDate,
      horarioFim: normalizedFormData.horarioFim,
      nomeLocal: normalizedFormData.nomeLocal,
      endereco: normalizedFormData.endereco,
      contatoLocal: normalizedFormData.contatoLocal,
      capacidadePublico: normalizedFormData.capacidadePublico,
      valorCache: normalizedFormData.valorCache,
      publicoEsperado: normalizedFormData.publicoEsperado,
      descricao: normalizedFormData.descricao,
      observacoes: normalizedFormData.observacoes,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0];
        if (field && !newErrors[field]) {
          newErrors[String(field)] = err.message;
        }
      });
      setErrors(newErrors);
      const details = result.error.errors.map((e) => ({ path: e.path, message: e.message }));
      // Expected client-side validation (the user left a required field
      // blank) — already reported via toast + inline FieldError.
      // console.error would pollute error monitoring (Sentry captures
      // console.error) with an event that is not a runtime failure.
      console.warn("SchedulerFormModal validation errors:", details, { formData, normalizedFormData, event });
      const firstError = result.error.errors[0];
      const firstField = firstError?.path[0] ? String(firstError.path[0]) : "";
      const firstLabel = validationFieldLabels[firstField] ?? firstField;
      toast.error(firstLabel ? `${firstLabel}: ${firstError.message}` : "Por favor, corrija os erros no formulário");
      return null;
    }

    setErrors({});
    setFormData(normalizedFormData);
    return normalizedFormData;
  };

  // Maps frontend tipoEvento (granular, tenant-configurable) → backend
  // CreateEventDto.type enum (coarse: show|festival|recording|meeting|
  // interview|tour|other — the only thing events.type actually stores).
  // Primary source: metadata.backend_type of each category configured in
  // Settings → Operational (granularToBackendType, lib/event-type.ts).
  // The table below is only the fallback for legacy/hand-typed slugs that
  // match no configured category.
  const legacyTypeToBackendType: Record<string, string> = {
    shows:           "show",
    show:            "show",
    show_teatro:     "show",
    festival:        "festival",
    rodeio:          "show",
    lancamento:      "show",
    evento_corporativo: "other",
    gravacao:        "recording",
    gravacoes:       "recording",
    recording:       "recording",
    reuniao:         "meeting",
    reunioes:        "meeting",
    meeting:         "meeting",
    entrevista:      "interview",
    entrevistas:     "interview",
    interview:       "interview",
    programas_tv:    "interview",
    radio:           "interview",
    podcasts:        "interview",
    tour:            "tour",
    turne:           "tour",
  };
  const mapTypeToBackendType = (type: string): string => {
    const t = (type || "").toLowerCase();
    if (granularToBackendType[t]) return granularToBackendType[t];
    return legacyTypeToBackendType[t] ?? "other";
  };

  // Combine `YYYY-MM-DD` + `HH:mm` → ISO datetime string for backend.
  const combineDateAndTime = (date: Date | undefined, time: string): string | undefined => {
    if (!date || !isValid(date)) return undefined;
    const normalizedTime = normalizeTimeValue(time);
    if (normalizedTime) {
      const [h, m] = normalizedTime.split(":").map((n) => Number(n));
      const dt = new Date(date);
      dt.setHours(h, m, 0, 0);
      return dt.toISOString();
    }
    return date.toISOString();
  };

  const toNumberOrUndefined = (v: unknown): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };

  // Maps frontend status (pt-BR) → backend UpdateEventDto.status enum.
  // Backend enum (EventStatus, @music-os-360/types): planned | scheduled |
  // confirmed | held | completed | cancelled | postponed
  const mapStatusToBackend = (status: string): string | undefined => {
    const s = (status || "").toLowerCase();
    const map: Record<string, string> = {
      agendado:    "scheduled",
      pendente:    "scheduled",
      confirmado:  "confirmed",
      cancelado:   "cancelled",
      concluido:   "completed",
      realizado:   "held",
      planejado:   "planned",
      postponed:   "postponed",
      adiado:      "postponed",
      scheduled:   "scheduled",
      confirmed:   "confirmed",
      cancelled:   "cancelled",
      completed:   "completed",
    };
    return map[s];
  };

  /**
   * Maps form state → backend CreateEventDto / UpdateEventDto shape.
   *
   * The backend NestJS ValidationPipe runs with whitelist + forbidNonWhitelisted,
   * so any field outside the DTO is rejected with 400. Product rule
   * 2026-07-12: each form field has its own DTO/entity column
   * (endereco, contato_local, valor_cache, publico_esperado, descricao,
   * observacoes, participantes) — no formal field goes into `metadata`.
   *
   * @param forUpdate when true, includes the `status` field (valid in UpdateEventDto,
   *                  forbidden in CreateEventDto).
   */
  const buildPayload = (data: SchedulerFormData, forUpdate = false) => {
    const startDate = normalizeEventDate(data.startDate);
    const endDate    = normalizeEventDate(data.endDate);

    const startsAt = combineDateAndTime(startDate, data.horarioInicio);
    const endsAt   = combineDateAndTime(endDate, data.horarioFim);

    const payload: Record<string, unknown> = {
      title: String(data.title || "").trim(),
      type:  mapTypeToBackendType(data.tipoEvento),
    };

    const firstArtistParticipant = data.participantes.find((participant) => participant.source === "artist");
    const artistId = (firstArtistParticipant?.id || data.artista || "").trim();
    if (artistId) payload["artistId"] = artistId;
    if (data.nomeLocal) payload["venue"] = data.nomeLocal;
    if (startsAt) payload["startsAt"] = startsAt;
    if (endsAt)   payload["endsAt"]   = endsAt;

    const capacity = toNumberOrUndefined(data.capacidadePublico);
    if (capacity !== undefined) payload["capacity"] = capacity;

    if (data.endereco)      payload["endereco"]      = data.endereco;
    if (data.contatoLocal)  payload["contato_local"]  = data.contatoLocal;
    const feeAmount = toNumberOrUndefined(data.valorCache);
    if (feeAmount !== undefined) payload["fee_amount"] = feeAmount;
    const expectedAudience = toNumberOrUndefined(data.publicoEsperado);
    if (expectedAudience !== undefined) payload["publico_esperado"] = expectedAudience;
    if (data.descricao)   payload["description"] = data.descricao;
    if (data.observacoes) payload["notes"]       = data.observacoes;
    if (data.participantes.length > 0) payload["participantes"] = data.participantes;

    if (forUpdate) {
      const mappedStatus = mapStatusToBackend(data.status);
      if (mappedStatus) payload["status"] = mappedStatus;
    }

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return;

    const normalizedFormData = getNormalizedFormData();
    const validatedFormData = mode === "edit" ? normalizedFormData : validate();
    if (!validatedFormData) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "edit") {
        if (!event?.id) {
          toast.error("Não foi possível atualizar: evento sem identificador.");
          return;
        }
        await updateEvent.mutateAsync({
          id: event.id,
          ...buildPayload(validatedFormData, true),
          expectedUpdatedAt: getExpectedUpdatedAt(event),
        });
      } else {
        await addEvent.mutateAsync(buildPayload(validatedFormData, false));
      }
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.EVENTS] });
      onOpenChange(false);
    } catch (error) {
      // The mutation already fires a generic error toast; here we only need the
      // specific concurrency-conflict (409) warning, which the mutation
      // alone cannot tell apart from any other error.
      handleConcurrencyConflict(error, "evento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLocalPlaceholder = () => {
    if (formData.tipoEvento === "reunioes") {
      return "Nome do local da reunião";
    }
    return "Nome do venue / casa de show";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Event title */}
            <div className="space-y-2 md:col-span-2">
              <Label>Título do Evento *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Digite o título do evento"
                disabled={isViewMode}
                className={errors.title ? "border-destructive" : ""}
              />
              <FieldError error={errors.title} />
            </div>

            {/* Event type */}
            <div className="space-y-2">
              <Label>Tipo de Evento *</Label>
              <Select 
                value={formData.tipoEvento} 
                onValueChange={(v) => setFormData({ ...formData, tipoEvento: v })} 
                disabled={isViewMode}
              >
                <SelectTrigger className={errors.tipoEvento ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError error={errors.tipoEvento} />
            </div>

            <div className="space-y-2">
              <Label>Participantes do Evento</Label>
              <DropdownMenu onOpenChange={(open) => { if (!open) setParticipantSearch(""); }}>
                <DropdownMenuTrigger asChild disabled={isViewMode}>
                  <Button type="button" variant="outline" className="h-8 w-full justify-between font-normal">
                    <span className={selectedParticipantsSummary ? "truncate" : "text-muted-foreground"}>
                      {selectedParticipantsSummary || "Selecione participantes"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
                  <div className="relative p-1.5 pb-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Buscar artista ou funcionário…"
                      className="h-7 pl-7 text-xs"
                      data-testid="input-buscar-participante"
                    />
                  </div>
                  {participants.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">Nenhum participante encontrado</div>
                  ) : participants.map((participant) => {
                    const key = agendaParticipantKey(participant);
                    return (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={selectedParticipantKeys.includes(key)}
                        onCheckedChange={() => handleParticipantToggle(key)}
                        onSelect={(event) => event.preventDefault()}
                      >
                        <span className="min-w-0 truncate">{participant.label}</span>
                        {participant.category && (
                          <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">{participant.category}</span>
                        )}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })} 
                disabled={isViewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates and times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start date */}
            <div className="space-y-2">
              <Label>Data de Início *</Label>
              <DatePickerField
                value={formData.startDate ? format(formData.startDate, "yyyy-MM-dd") : ""}
                onChange={(iso) => setFormData({ ...formData, startDate: iso ? parseISO(iso) : undefined })}
                disabled={isViewMode}
                placeholder="Selecione a data"
                className={errors.startDate ? "border-destructive" : ""}
                data-testid="datepicker-data-inicio"
              />
              <FieldError error={errors.startDate} />
            </div>

            {/* Start time */}
            <div className="space-y-2">
              <Label>Horário de Início</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={formData.horarioInicio}
                  onChange={(e) => setFormData({ ...formData, horarioInicio: e.target.value })}
                  disabled={isViewMode}
                  className="pl-10"
                />
              </div>
            </div>

            {/* End date */}
            <div className="space-y-2">
              <Label>Data de Fim</Label>
              <DatePickerField
                value={formData.endDate ? format(formData.endDate, "yyyy-MM-dd") : ""}
                onChange={(iso) => setFormData({ ...formData, endDate: iso ? parseISO(iso) : undefined })}
                disabled={isViewMode}
                placeholder="Selecione a data (opcional)"
                data-testid="datepicker-data-fim"
              />
            </div>

            {/* End time */}
            <div className="space-y-2">
              <Label>Horário de Fim</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={formData.horarioFim}
                  onChange={(e) => setFormData({ ...formData, horarioFim: e.target.value })}
                  disabled={isViewMode}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Venue fields - conditional */}
          {showLocalFields && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Local</Label>
                {shouldUseCRMLocal ? (
                  <AsyncEntityCombobox<LocalCRMLookup>
                    table="clientes"
                    getLabel={(local) => local.nome}
                    value={formData.nomeLocal}
                    onChange={handleLocalCRMChange}
                    filters={{ type: "pessoa_juridica" }}
                    placeholder="Selecione o local (CRM)"
                    searchPlaceholder="Buscar local…"
                    disabled={isViewMode}
                    data-testid="combobox-local-crm"
                  />
                ) : (
                  <Input
                    value={formData.nomeLocal}
                    onChange={(e) => setFormData({ ...formData, nomeLocal: e.target.value })}
                    placeholder={getLocalPlaceholder()}
                    disabled={isViewMode}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Contato do Local</Label>
                <Input
                  value={formData.contatoLocal}
                  onChange={(e) => setFormData({ ...formData, contatoLocal: e.target.value })}
                  placeholder="Telefone / WhatsApp do local"
                  disabled={shouldUseCRMLocal || isViewMode}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Endereço Completo</Label>
                <Input
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Endereço completo do local"
                  disabled={shouldUseCRMLocal || isViewMode}
                />
              </div>
            </div>
          )}

          {/* Show-only fields */}
          {isShow && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Capacidade do Público</Label>
                <Input
                  type="number"
                  value={formData.capacidadePublico}
                  onChange={(e) => setFormData({ ...formData, capacidadePublico: e.target.value })}
                  placeholder="Capacidade máxima do local"
                  disabled={isViewMode}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Valor do Cachê</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valorCache}
                    onChange={(e) => setFormData({ ...formData, valorCache: e.target.value })}
                    placeholder="0,00"
                    disabled={isViewMode}
                    className="pl-10"
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Público Esperado</Label>
                <Input
                  type="number"
                  value={formData.publicoEsperado}
                  onChange={(e) => setFormData({ ...formData, publicoEsperado: e.target.value })}
                  placeholder="Quantidade de pessoas esperadas"
                  disabled={isViewMode}
                  min="0"
                />
              </div>
            </div>
          )}

          {/* Description and notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do evento"
                rows={3}
                disabled={isViewMode}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o evento"
                rows={3}
                disabled={isViewMode}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            {!isViewMode && (
              <Button type="submit" size="sm" className="gap-2 bg-primary" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar Evento"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

