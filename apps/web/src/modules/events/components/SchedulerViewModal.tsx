import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Calendar, Clock, MapPin, User, Phone, Mail, Users, DollarSign, Tag, FileText, Pencil, Building2 } from "lucide-react";
import { formatCurrency, formatDate, getMonetarySemanticClass } from "@/shared/lib/format-utils";
import { normalizeScheduleParticipants, useScheduleParticipants } from "@/modules/events/hooks/useScheduleParticipants";
import { getBackendEventTypeLabel } from "@/modules/events/lib/event-type";

interface SchedulerViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: any;
  onEdit?: () => void;
}

// events.status is the real value persisted by the backend — canonical English
// (EventStatus de @music-os-360/types). Ver docs/NAMING_NORMALIZATION_CANONICAL_MAP.md.
const getStatusBadge = (status: string) => {
  switch (status) {
    case "confirmed": return <Badge variant="success">Confirmado</Badge>;
    case "planned":
    case "scheduled": return <Badge variant="warning">Pendente</Badge>;
    case "held":
    case "completed": return <Badge variant="info">Realizado</Badge>;
    case "cancelled": return <Badge variant="danger">Cancelado</Badge>;
    case "postponed": return <Badge variant="neutral">Adiado</Badge>;
    default: return <Badge variant="neutral">{status || "—"}</Badge>;
  }
};

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground border-b border-border pb-2">
        <Icon className="h-4 w-4" />
        <span className=" tracking-wide text-xs">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || <span className="text-muted-foreground italic">—</span>}</p>
    </div>
  );
}

export function SchedulerViewModal({ open, onOpenChange, event, onEdit }: SchedulerViewModalProps) {
  const { getArtistParticipantById } = useScheduleParticipants();

  if (!event) return null;

  const artist = event.artist;
  const meta = (event.metadata as Record<string, unknown> | undefined) ?? {};
  const storedParticipants = normalizeScheduleParticipants(meta["participants"]);
  const legacyArtistParticipant = getArtistParticipantById(event.artist_id);
  const participants = storedParticipants.length > 0
    ? storedParticipants
    : legacyArtistParticipant
      ? [legacyArtistParticipant]
      : artist
        ? [{
            source: "artist" as const,
            id: String(artist.id ?? event.artist_id ?? "legacy-artist"),
            label: String(artist.stage_name || "Artista"),
            email: artist.email ? String(artist.email) : undefined,
            phone: artist.phone ? String(artist.phone) : undefined,
            category: "Artista",
          }]
        : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-[28px] bg-card ring-1 ring-border/10" data-testid="modal-event-view">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/10">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-2xl font-semibold tracking-tight" data-testid="text-event-title">{event.title}</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-muted-foreground">
                Detalhes completos do evento
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {getBackendEventTypeLabel(event.type)}
                </Badge>
                {getStatusBadge(event.status)}
              </div>
            </div>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-foreground">
          {/* DATE AND TIME */}
          <Section title="Quando" icon={Calendar}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Data Início" value={formatDate(event.starts_at)} />
              <Field label="Horário Início" value={event.starts_at ? new Date(event.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null} />
              <Field label="Data Fim" value={event.end_date ? formatDate(event.end_date) : null} />
              <Field label="Horário Fim" value={event.end_date ? new Date(event.end_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null} />
            </div>
          </Section>

          {/* LOCAL */}
          <Section title="Onde" icon={MapPin}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Local" value={event.venue} />
              <Field label="Endereço" value={event.address} />
            </div>
          </Section>

          {participants.length > 0 && (
            <Section title="Participantes do Evento" icon={User}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {participants.map((participant) => (
                  <Card key={`${participant.source}:${participant.id}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" data-testid="text-event-artist">
                          {participant.label}
                        </p>
                        {participant.category && (
                          <p className="text-xs text-muted-foreground">{participant.category}</p>
                        )}
                      </div>
                      {(participant.email || participant.phone) && (
                        <div className="hidden sm:flex flex-col text-right text-xs text-muted-foreground">
                          {participant.email && <span>{participant.email}</span>}
                          {participant.phone && <span>{participant.phone}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* ARTIST */}
          {artist && participants.length === 0 && (
            <Section title="Artista" icon={User}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" data-testid="text-event-artist">
                      {artist.stage_name || "—"}
                    </p>
                    {artist.music_genre && (
                      <p className="text-xs text-muted-foreground">{artist.music_genre}</p>
                    )}
                  </div>
                  {artist.email && (
                    <div className="hidden sm:flex flex-col text-right text-xs text-muted-foreground">
                      <span>{artist.email}</span>
                      {artist.phone && <span>{artist.phone}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Section>
          )}

          {/* VENUE CONTACT */}
          {event.venue_contact && (
            <Section title="Contato no Local" icon={Phone}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field
                  label="Responsável"
                  value={
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {event.venue_contact}
                    </span>
                  }
                />
              </div>
            </Section>
          )}

          {/* OPERATIONAL DETAILS (Show) */}
          {(event.fee_amount != null || event.expected_attendance != null) && (
            <Section title="Detalhes Operacionais" icon={DollarSign}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {event.fee_amount != null && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Cachê</p>
                      <p className={`text-xl font-bold mt-1 ${getMonetarySemanticClass("neutral")}`} data-testid="text-event-fee">
                        {formatCurrency(event.fee_amount)}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {event.expected_attendance != null && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Público Esperado</p>
                      <p className="text-xl font-bold mt-1 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {Number(event.expected_attendance).toLocaleString("pt-BR")}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </Section>
          )}

          {/* DESCRIPTION */}
          {event.description && (
            <Section title="Descrição" icon={FileText}>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap" data-testid="text-event-description">
                    {event.description}
                  </p>
                </CardContent>
              </Card>
            </Section>
          )}

          {/* NOTES */}
          {event.notes && (
            <Section title="Observações" icon={FileText}>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes}</p>
                </CardContent>
              </Card>
            </Section>
          )}
        </div>

        <DialogFooter className="mt-4 flex justify-end gap-2 border-t border-border/20 px-6 pb-6 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-event">
            Fechar
          </Button>
          {onEdit && (
            <Button onClick={onEdit} data-testid="button-edit-event-view">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
