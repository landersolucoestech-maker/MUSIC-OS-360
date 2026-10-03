import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Badge }  from "@/shared/ui/badge";
import {
  ChatAttachment,
  resolveAttachmentKind,
  type ChatAttachmentData,
} from "@/shared/components/ChatAttachment";
import {
  AtSign, Briefcase, Building2, Calendar, CalendarClock,
  DollarSign, FileText, Flag, Globe, Hash, Instagram, Mail,
  MapPin, MessageSquare, Music, Phone, Sparkles, Star, Tag,
  Thermometer, User, UserCog, Users,
} from "lucide-react";
import type { Lead } from "../types";
import {
  LEAD_SOURCE_OPTIONS,
  PRIORITY_OPTIONS,
  SERVICES_OPTIONS,
  STATUS_LEAD_OPTIONS,
  EVENT_TYPE_OPTIONS,
  LEAD_TYPE_OPTIONS,
  INTERACTION_TYPE_OPTIONS,
  TEMPERATURE_OPTIONS,
  LEAD_TYPE_MANAGER,
  LEAD_TYPE_INFLUENCER,
  EVENT_COMBOS,
  CAMPAIGN_COMBOS,
  ARTIST_EVENT_COMBOS,
  matchCombo,
} from "../constants/lead-form-options";
import type { Interaction } from "./LeadFormModal";
import { useLeadInteractions } from "../hooks/useLeadInteractions";
import { LEAD_INTERACTION_TYPE_LABELS } from "../services/lead-interactions.service";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface LeadViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onEdit?: (lead: Lead) => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const lookup = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value?: string | null,
) => options.find((o) => o.value === value)?.label ?? (value || "-");

const fmtDate = (value?: string | null) => {
  if (!value) return "-";
  try { return new Date(value).toLocaleDateString("pt-BR"); }
  catch { return value; }
};

const fmtMoney = (value?: number | null) =>
  value == null
    ? "-"
    : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-wider text-muted-foreground border-b pb-1">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const isEmpty = value == null || value === "" || value === "-";
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </p>
      <p className={
        isEmpty
          ? "text-sm text-muted-foreground italic"
          : "text-sm text-foreground break-words"
      }>
        {isEmpty ? "—" : value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export function LeadViewModal({
  open, onOpenChange, lead, onEdit,
}: LeadViewModalProps) {
  // REM-04 (GAP-10): real team interaction log (lead_interactions),
  // distinct from the "Histórico de Interações" below (which comes from the payload of the
  // intake form). Hook called before the early return (Rules of Hooks).
  const { data: teamInteractions = [] } = useLeadInteractions(lead?.id);

  if (!lead) return null;

  const ps  = (lead.servicePayload   ?? {}) as Record<string, unknown>;
  const crm = (lead.crmInternalData ?? {}) as Record<string, unknown>;

  const str = (key: string): string =>
    typeof ps[key] === "string" ? (ps[key] as string) : "";

  const leadType = str("leadType");
  const service  = str("service");

  const showEvent             = matchCombo(EVENT_COMBOS,          leadType, service);
  const showCampaign           = matchCombo(CAMPAIGN_COMBOS,        leadType, service);
  const showInfluencer         = leadType === LEAD_TYPE_INFLUENCER && !showEvent;
  const showManager         = leadType === LEAD_TYPE_MANAGER && !showEvent;
  const showArtistBandEvent = matchCombo(ARTIST_EVENT_COMBOS,  leadType, service);

  const interactions = Array.isArray(ps.interactions)
    ? (ps.interactions as Interaction[])
    : [];
  const uploads = lead.uploads ?? [];

  const cityDisplay = str("city") || lead.city || "";
  const stateDisplay = str("state") || lead.state || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="lead-view-modal"
      >
        <DialogHeader>
          <DialogTitle
            data-testid="lead-view-title"
            className="flex items-center gap-3"
          >
            {lead.fullName || "Lead"}
            {(lead.status) && (
              <Badge variant="outline" className="text-xs">
                {lookup(STATUS_LEAD_OPTIONS, lead.status)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Visualização dos dados do lead</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">

          {/* ══════════════════════════════════════
              LEAD IDENTIFICATION
          ══════════════════════════════════════ */}
          <Section title="Identificação do Lead">
            <Row icon={User}      label="Nome"                  value={lead.fullName}                        />
            <Row icon={Building2} label="Empresa / Contratante" value={lead.company}                             />
            <Row icon={Briefcase} label="Cargo / Função"        value={str("jobTitle")}                             />
            <Row icon={Mail}      label="E-mail"                  value={lead.email}                               />
            <Row icon={Phone}     label="Telefone / WhatsApp"   value={lead.whatsapp}                            />
            <Row icon={Instagram} label="Instagram"             value={lead.instagram}                           />
            <Row icon={Globe}     label="Site"               value={str("website")}                           />
            <Row icon={MapPin}    label="Endereço"              value={str("address")}                          />
            <Row icon={MapPin}    label="Cidade"                value={lead.city}                                />
            <Row icon={Hash}      label="Estado"                value={lead.state}                               />
            <Row icon={Tag}       label="Tipo de Lead"          value={lookup(LEAD_TYPE_OPTIONS, leadType)}      />
            <Row icon={Sparkles}  label="Serviço"               value={lookup(SERVICES_OPTIONS,  service)}       />
            {str("serviceArtistName") && (
              <Row
                icon={Music}
                label="Artista/Banda/Influenciador"
                value={str("serviceArtistName")}
              />
            )}
            <div className="sm:col-span-2">
              <Row icon={FileText} label="Descrição da Demanda" value={str("description")} />
            </div>
          </Section>

          {/* ══════════════════════════════════════
              ORIGIN AND SALES MANAGEMENT
          ══════════════════════════════════════ */}
          <Section title="Origem e Gestão Comercial">
            <Row icon={AtSign}        label="Origem do Lead"        value={lookup(LEAD_SOURCE_OPTIONS, crm.leadSource as string)} />
            <Row icon={Flag}          label="Status do Lead"        value={lookup(STATUS_LEAD_OPTIONS, lead.status)} />
            <Row icon={Star}          label="Prioridade"            value={lookup(PRIORITY_OPTIONS,  crm.priority as string)} />
            <Row icon={UserCog}       label="Responsável pelo Lead" value={crm.responsiblePerson as string}  />
            <Row icon={Tag}           label="Campanha de Marketing" value={crm.marketingCampaign as string}  />
            <Row icon={Calendar}      label="Data de Entrada"       value={fmtDate(str("entryDate") || lead.createdAt)}        />
            <Row icon={CalendarClock} label="Próximo Follow-up"     value={fmtDate(crm.nextFollowUpAt as string)} />
            <Row icon={DollarSign}    label="Valor Estimado"        value={fmtMoney(crm.estimatedValue as number)} />
            <Row icon={Thermometer}   label="Temperatura"           value={lookup(TEMPERATURE_OPTIONS, crm.temperature as string)} />
          </Section>

          {/* ══════════════════════════════════════
              EVENT DETAILS
          ══════════════════════════════════════ */}
          {showEvent && (
            <Section title="Detalhes do Evento">
              <Row icon={Sparkles} label="Nome do Evento"        value={str("eventName")}                               />
              <Row icon={Tag}      label="Tipo de Evento"        value={lookup(EVENT_TYPE_OPTIONS, str("eventType"))}  />
              <Row icon={Calendar} label="Data do Evento"        value={fmtDate(str("eventDate"))}                     />
              <Row icon={MapPin}   label="Local do Evento"       value={str("eventVenue")}                              />
              <Row icon={MapPin}   label="Cidade"                value={cityDisplay}                                    />
              <Row icon={Hash}     label="Estado"                value={stateDisplay}                                    />
              <Row icon={Users}    label="Capacidade de Público" value={str("audienceCapacity")}                        />
              {showArtistBandEvent && (
                <Row icon={Music} label="Nome do Artista / Banda" value={str("artistName")} />
              )}
              <div className="sm:col-span-2">
                <Row icon={FileText} label="Necessidades Adicionais" value={str("additionalNeeds")} />
              </div>
            </Section>
          )}

          {/* ══════════════════════════════════════
              CAMPAIGN DETAILS
          ══════════════════════════════════════ */}
          {showCampaign && (
            <Section title="Detalhes da Campanha">
              <Row icon={Sparkles} label="Nome da Campanha"        value={str("campaignName")}         />
              <Row icon={Tag}      label="Tipo da Campanha"        value={str("campaignType")}         />
              <Row icon={Calendar} label="Data de Início"          value={fmtDate(str("start_date"))}  />
              <Row icon={Calendar} label="Data de Fim"             value={fmtDate(str("end_date"))}     />
              <Row icon={MapPin}   label="Cidade"                  value={cityDisplay}                />
              <Row icon={Hash}     label="Estado"                  value={stateDisplay}                />
              <Row icon={Music}    label="Nome do Artista / Banda" value={str("artistName")}    />
              <div className="sm:col-span-2">
                <Row icon={FileText} label="Necessidades Adicionais" value={str("additionalNeeds")} />
              </div>
            </Section>
          )}

          {/* ══════════════════════════════════════
              INFLUENCER DETAILS
          ══════════════════════════════════════ */}
          {showInfluencer && (
            <Section title="Detalhes do Influenciador">
              <Row icon={Sparkles} label="Nome da Campanha"  value={str("campaignName")}             />
              <Row icon={Tag}      label="Tipo da Campanha"  value={str("campaignType")}             />
              <Row icon={MapPin}   label="Local da Campanha" value={str("campaignLocation")}            />
              <Row icon={Calendar} label="Data"              value={fmtDate(str("date"))}             />
              <Row icon={MapPin}   label="Cidade"            value={cityDisplay}                    />
              <Row icon={Hash}     label="Estado"            value={stateDisplay}                    />
              <div className="sm:col-span-2">
                <Row icon={FileText} label="Necessidades Adicionais" value={str("additionalNeeds")} />
              </div>
            </Section>
          )}

          {/* ══════════════════════════════════════
              ARTIST MANAGER DETAILS
          ══════════════════════════════════════ */}
          {showManager && (
            <Section title="Detalhes do Empresário Artístico">
              <Row icon={Music} label="Nome do Artista / Banda" value={str("artistName")} />
              <div className="sm:col-span-2">
                <Row icon={FileText} label="Necessidades Adicionais" value={str("additionalNeeds")} />
              </div>
            </Section>
          )}

          {/* ══════════════════════════════════════
              INTERACTION HISTORY
          ══════════════════════════════════════ */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground border-b pb-1">
              Histórico de Interações
            </h3>
            {interactions.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Nenhuma interação registrada.
              </p>
            ) : (
              <div className="space-y-3" data-testid="lead-view-interactions">
                {interactions.map((it, idx) => (
                  <div
                    key={it.id}
                    className="rounded-md border bg-muted/20 p-3 space-y-1"
                    data-testid={`lead-view-interaction-${it.id}`}
                  >
                    <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Interação {idx + 1} · {lookup(INTERACTION_TYPE_OPTIONS, it.type)} · {fmtDate(it.date)}{it.time ? ` ${it.time}` : ""}
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {it.description || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ══════════════════════════════════════
              TEAM INTERACTION LOG (REM-04 / GAP-10)
          ══════════════════════════════════════ */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground border-b pb-1">
              Registro de Interações da Equipe
            </h3>
            {teamInteractions.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Nenhuma interação registrada pela equipe ainda.
              </p>
            ) : (
              <div className="space-y-3" data-testid="lead-view-team-interactions">
                {teamInteractions.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-md border bg-muted/20 p-3 space-y-1"
                    data-testid={`lead-view-team-interaction-${it.id}`}
                  >
                    <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {LEAD_INTERACTION_TYPE_LABELS[it.type] ?? it.type} · {fmtDate(it.occurredAt)}
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {it.notes || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wider text-muted-foreground border-b pb-1">
              Anexos
            </h3>
            {uploads.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Nenhum anexo adicionado.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2" data-testid="lead-view-uploads">
                {uploads.map((upload) => {
                  const attachment: ChatAttachmentData | null = upload.url
                    ? {
                        kind: resolveAttachmentKind(upload.mimeType, upload.fileName),
                        name: upload.fileName,
                        mime: upload.mimeType || (upload.fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
                        url: upload.url,
                      }
                    : null;
                  return (
                    <div key={upload.id} className="min-w-0 rounded-md border bg-muted/20 p-3">
                      {attachment ? (
                        <ChatAttachment attachment={attachment} />
                      ) : (
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{upload.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {upload.extension || upload.mimeType} - {(upload.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-view"
          >
            Fechar
          </Button>
          {onEdit && (
            <Button
              onClick={() => { onOpenChange(false); onEdit(lead); }}
              data-testid="button-edit-from-view"
            >
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
