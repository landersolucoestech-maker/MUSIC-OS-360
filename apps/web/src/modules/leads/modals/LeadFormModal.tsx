import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Plus, Trash2, Upload, X } from "lucide-react";
import { handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button }          from "@/shared/ui/button";
import { Input }           from "@/shared/ui/input";
import { Label }           from "@/shared/ui/label";
import { Textarea }        from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { maskPhone }       from "@/shared/lib/masks";
import { useOperationalSettings } from "@/modules/settings/hooks/useOperationalSettings";
import { useUploadToR2, R2NotConfiguredError } from "@/shared/hooks/useUploadToR2";

import {
  BR_STATES,
  LEAD_SOURCE_OPTIONS,
  PRIORITY_OPTIONS,
  EVENT_TYPE_OPTIONS,
  INTERACTION_TYPE_OPTIONS,
  TEMPERATURE_OPTIONS,
  LEAD_TYPE_MANAGER,
  LEAD_TYPE_INFLUENCER,
  LEAD_TYPE_OTHER,
  EVENT_COMBOS,
  CAMPAIGN_COMBOS,
  ARTIST_EVENT_COMBOS,
  matchCombo,
  LEAD_TYPE_OPTIONS,
  getServicesForLeadType,
  type LeadType,
} from "../constants/lead-form-options";
import type { LeadUpload } from "../types";
import { toUserMessage } from "@/shared/lib/errors";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type Interaction = {
  id: string;
  type: string;
  date: string;
  time: string;
  description: string;
};

type ConditionalEventPayload = {
  eventName: string;
  eventType: string;
  eventDate: string;
  eventVenue: string;
  city: string;
  state: string;
  audienceCapacity: string;
  artistName: string;
  additionalNeeds: string;
};

type ConditionalCampaignPayload = {
  campaignName: string;
  campaignType: string;
  start_date: string;
  end_date: string;
  city: string;
  state: string;
  artistName: string;
  additionalNeeds: string;
};

type ConditionalInfluencerPayload = {
  campaignName: string;
  campaignType: string;
  campaignLocation: string;
  date: string;
  city: string;
  state: string;
  additionalNeeds: string;
};

type ConditionalManagerPayload = {
  artistName: string;
  additionalNeeds: string;
};

export type LeadFormPayload = {
  name: string;
  company: string;
  jobTitle: string;
  email: string;
  phone: string;
  instagram: string;
  website: string;
  address: string;
  city: string;
  state: string;
  leadType: LeadType | "";
  service: string;
  serviceArtistName: string;
  description: string;
  leadSource: string;
  marketingCampaign: string;
  entryDate: string;
  leadStatus: string;
  priority: string;
  responsiblePerson: string;
  nextFollowUpAt: string;
  estimatedValue: string;
  temperature: string;
  event?: ConditionalEventPayload;
  campaign?: ConditionalCampaignPayload;
  influencer?: ConditionalInfluencerPayload;
  manager?: ConditionalManagerPayload;
  interactions: Interaction[];
  uploads: LeadUpload[];
};

export type LeadFormMode = "create" | "edit";

interface LeadFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: LeadFormMode;
  initialValue?: Partial<LeadFormPayload> | null;
  onSubmit?: (payload: LeadFormPayload) => void | Promise<void>;
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────
const EVENT_DEFAULT: ConditionalEventPayload = {
  eventName: "", eventType: "", eventDate: "",
  eventVenue: "", city: "", state: "",
  audienceCapacity: "", artistName: "",
  additionalNeeds: "",
};

const CAMPAIGN_DEFAULT: ConditionalCampaignPayload = {
  campaignName: "", campaignType: "",
  start_date: "", end_date: "",
  city: "", state: "",
  artistName: "", additionalNeeds: "",
};

const INFLUENCER_DEFAULT: ConditionalInfluencerPayload = {
  campaignName: "", campaignType: "", campaignLocation: "",
  date: "", city: "", state: "", additionalNeeds: "",
};

const MANAGER_DEFAULT: ConditionalManagerPayload = {
  artistName: "", additionalNeeds: "",
};

const todayISO = () => new Date().toISOString().split("T")[0];

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildDefaults = (
  initial?: Partial<LeadFormPayload> | null,
): LeadFormPayload => ({
  name:                 initial?.name                 ?? "",
  company:              initial?.company              ?? "",
  jobTitle:                initial?.jobTitle                ?? "",
  email:                initial?.email                ?? "",
  phone:             initial?.phone             ?? "",
  instagram:            initial?.instagram            ?? "",
  website:              initial?.website              ?? "",
  address:             initial?.address             ?? "",
  city:               initial?.city               ?? "",
  state:               initial?.state               ?? "",
  leadType:            (initial?.leadType as LeadType) ?? "",
  service:              initial?.service              ?? "",
  serviceArtistName: initial?.serviceArtistName ?? "",
  description:            initial?.description            ?? "",
  leadSource:          initial?.leadSource          ?? "",
  marketingCampaign:   initial?.marketingCampaign   ?? "",
  entryDate:         initial?.entryDate         ?? todayISO(),
  leadStatus:          initial?.leadStatus          ?? "new",
  priority:           initial?.priority           ?? "medium",
  responsiblePerson:          initial?.responsiblePerson          ?? "",
  nextFollowUpAt:    initial?.nextFollowUpAt    ?? "",
  estimatedValue:       initial?.estimatedValue       ?? "",
  temperature:          initial?.temperature          ?? "",
  event:               initial?.event               ?? { ...EVENT_DEFAULT },
  campaign:             initial?.campaign             ?? { ...CAMPAIGN_DEFAULT },
  influencer:        initial?.influencer        ?? { ...INFLUENCER_DEFAULT },
  manager:           initial?.manager           ?? { ...MANAGER_DEFAULT },
  interactions:           initial?.interactions           ?? [],
  uploads:              initial?.uploads              ?? [],
});

// ─────────────────────────────────────────────
// Helpers de UI
// ─────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-sm font-semibold tracking-wider text-muted-foreground border-b pb-1 pt-2">
      {title}
    </p>
  );
}

function Field({ label, htmlFor, children }: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder, testId }: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder={placeholder ?? "Selecione"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export function LeadFormModal({
  open, onOpenChange, mode, initialValue, onSubmit,
}: LeadFormModalProps) {
  const [values, setValues]         = useState<LeadFormPayload>(() => buildDefaults(initialValue));
  const [submitting, setSubmitting] = useState(false);
  const { getOptionsByKind } = useOperationalSettings();
  const leadStatusOptions = getOptionsByKind("lead_status");
  const { upload: uploadToR2 } = useUploadToR2();

  useEffect(() => {
    if (open) setValues(buildDefaults(initialValue));
  }, [open, initialValue]);

  // ── Setters ──────────────────────────────────
  const set = <K extends keyof LeadFormPayload>(
    field: K, value: LeadFormPayload[K],
  ) => setValues((prev) => ({ ...prev, [field]: value }));

  const setEvent = <K extends keyof ConditionalEventPayload>(
    field: K, value: ConditionalEventPayload[K],
  ) => setValues((prev) => ({
    ...prev,
    event: { ...(prev.event ?? EVENT_DEFAULT), [field]: value },
  }));

  const setCampaign = <K extends keyof ConditionalCampaignPayload>(
    field: K, value: ConditionalCampaignPayload[K],
  ) => setValues((prev) => ({
    ...prev,
    campaign: { ...(prev.campaign ?? CAMPAIGN_DEFAULT), [field]: value },
  }));

  const setInfluencer = <K extends keyof ConditionalInfluencerPayload>(
    field: K, value: ConditionalInfluencerPayload[K],
  ) => setValues((prev) => ({
    ...prev,
    influencer: { ...(prev.influencer ?? INFLUENCER_DEFAULT), [field]: value },
  }));

  const setManager = <K extends keyof ConditionalManagerPayload>(
    field: K, value: ConditionalManagerPayload[K],
  ) => setValues((prev) => ({
    ...prev,
    manager: { ...(prev.manager ?? MANAGER_DEFAULT), [field]: value },
  }));

  // ── Interactions ───────────────────────────────
  const addInteraction = () => {
    const newInteraction: Interaction = {
      id: newId(), type: "whatsapp",
      date: todayISO(), time: nowTime(), description: "",
    };
    setValues((prev) => ({ ...prev, interactions: [...prev.interactions, newInteraction] }));
  };

  const updateInteraction = <K extends keyof Interaction>(
    id: string, field: K, value: Interaction[K],
  ) => setValues((prev) => ({
    ...prev,
    interactions: prev.interactions.map((i) =>
      i.id === id ? { ...i, [field]: value } : i,
    ),
  }));

  const removeInteraction = (id: string) =>
    setValues((prev) => ({
      ...prev,
      interactions: prev.interactions.filter((i) => i.id !== id),
    }));

  // ── Flags condicionais ───────────────────────
  const addUploads = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
      try {
        const { publicUrl } = await uploadToR2({ file, category: "documents", entity: "lead" });
        const upload: LeadUpload = {
          id: newId(),
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          extension,
          url: publicUrl,
          uploadedAt: new Date().toISOString(),
        };
        setValues((prev) => ({ ...prev, uploads: [...prev.uploads, upload] }));
      } catch (err) {
        const msg = err instanceof R2NotConfiguredError
          ? toUserMessage(err)
          : toUserMessage(err, "Erro no upload do arquivo");
        toast.error(`${file.name}: ${msg}`);
      }
    }
  };

  const removeUpload = (id: string) =>
    setValues((prev) => ({ ...prev, uploads: prev.uploads.filter((upload) => upload.id !== id) }));

  const type    = values.leadType as LeadType | "";
  const service = values.service;

  const showEvent   = matchCombo(EVENT_COMBOS,   type, service);
  const showCampaign = matchCombo(CAMPAIGN_COMBOS, type, service);

  // showInfluencer and showManager are mutually exclusive with showEvent
  const showInfluencer = type === LEAD_TYPE_INFLUENCER && !showEvent;
  const showManager    = type === LEAD_TYPE_MANAGER    && !showEvent;

  const showArtistBandEvent = matchCombo(ARTIST_EVENT_COMBOS, type, service);

  // Artist/influencer field in the Classification section
  const showArtistBrandCompany    = type === "brand_or_company" && service === "artist_campaigns";
  const showArtistBandManager = type === LEAD_TYPE_MANAGER;
  const showInfluencerLeadType  = type === LEAD_TYPE_INFLUENCER;

  const showArtistField =
    showArtistBrandCompany    ||
    showArtistBandManager ||
    showInfluencerLeadType;

  const labelArtist =
    showInfluencerLeadType
      ? "Nome do Influenciador"
      : showArtistBandManager
      ? "Nome do Artista / Banda"
      : "Nome do Artista";

  const placeholderArtist =
    showInfluencerLeadType
      ? "Ex: @influenciador"
      : "Ex: João da Silva";

  const availableServices = useMemo(
    () => getServicesForLeadType(type),
    [type],
  );

  // ── Submit ───────────────────────────────────
  const handleSubmit = async () => {
    if (!onSubmit) { onOpenChange(false); return; }
    try {
      setSubmitting(true);
      await onSubmit({
        ...values,
        event:        showEvent        ? values.event        : undefined,
        campaign:      showCampaign      ? values.campaign      : undefined,
        influencer: showInfluencer ? values.influencer : undefined,
        manager:    showManager    ? values.manager    : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "lead")) return;
      toast.error("Erro ao salvar lead. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="lead-form-modal"
      >
        <DialogHeader>
          <DialogTitle data-testid="lead-form-title">
            {mode === "create" ? "Novo Lead" : "Editar Lead"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Cadastre um novo lead para gerar negócios"
              : "Edite os dados do lead"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">

          {/* ══════════════════════════════════════
              CONTACT DETAILS
          ══════════════════════════════════════ */}
          <SectionHeader title="Dados do Contato" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome completo">
              <Input
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nome do contato"
                data-testid="input-name"
              />
            </Field>
            <Field label="Empresa / Contratante">
              <Input
                value={values.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Nome da empresa"
                data-testid="input-company"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cargo / Função">
              <Input
                value={values.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
                placeholder="Ex: produtor, promoter..."
                data-testid="input-job-title"
              />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@exemplo.com"
                data-testid="input-email"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefone / WhatsApp">
              <Input
                value={values.phone}
                onChange={(e) => set("phone", maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                data-testid="input-phone"
              />
            </Field>
            <Field label="Instagram">
              <Input
                value={values.instagram}
                onChange={(e) => set("instagram", e.target.value)}
                placeholder="@usuario"
                data-testid="input-instagram"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Site">
              <Input
                value={values.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://..."
                data-testid="input-website"
              />
            </Field>
            <Field label="Endereço">
              <Input
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Rua, número..."
                data-testid="input-address"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cidade">
              <Input
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Ex: São Paulo"
                data-testid="input-city"
              />
            </Field>
            <Field label="Estado (UF)">
              <SelectField
                value={values.state}
                onChange={(v) => set("state", v)}
                options={BR_STATES.map((stateCode) => ({ value: stateCode, label: stateCode }))}
                placeholder="UF"
                testId="select-state"
              />
            </Field>
          </div>

          {/* ══════════════════════════════════════
              LEAD CLASSIFICATION
          ══════════════════════════════════════ */}
          <SectionHeader title="Classificação do Lead" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de Lead">
              <SelectField
                value={values.leadType}
                onChange={(v) => {
                  const newType = v as LeadType;
                  const validServices = getServicesForLeadType(newType).map((o) => o.value);
                  setValues((prev) => ({
                    ...prev,
                    leadType:            newType,
                    service:              validServices.includes(prev.service) ? prev.service : "",
                    serviceArtistName: "",
                  }));
                }}
                options={LEAD_TYPE_OPTIONS}
                testId="select-type-lead"
              />
            </Field>
            <Field label="Serviço">
              {values.leadType === LEAD_TYPE_OTHER ? (
                <Textarea
                  value={values.service}
                  onChange={(e) => set("service", e.target.value)}
                  placeholder="Descreva os serviços (um por linha)"
                  className="min-h-[80px]"
                  data-testid="textarea-service-other"
                />
              ) : (
                <SelectField
                  value={values.service}
                  onChange={(v) => set("service", v)}
                  options={availableServices}
                  placeholder={
                    values.leadType
                      ? "Selecione o serviço"
                      : "Selecione antes o tipo de lead"
                  }
                  testId="select-service"
                />
              )}
            </Field>
          </div>

          {showArtistField && (
            <Field label={labelArtist}>
              <Input
                value={values.serviceArtistName}
                onChange={(e) => set("serviceArtistName", e.target.value)}
                placeholder={placeholderArtist}
                data-testid="input-service-artist-name"
              />
            </Field>
          )}

          <Field label="Descrição da Demanda">
            <Textarea
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Descreva a demanda do lead"
              data-testid="textarea-description"
            />
          </Field>

          {/* ══════════════════════════════════════
              ORIGIN AND SALES MANAGEMENT
          ══════════════════════════════════════ */}
          <SectionHeader title="Origem e Gestão Comercial" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Origem do Lead">
              <SelectField
                value={values.leadSource}
                onChange={(v) => set("leadSource", v)}
                options={LEAD_SOURCE_OPTIONS}
                testId="select-source-lead"
              />
            </Field>
            <Field label="Campanha de Marketing">
              <Input
                value={values.marketingCampaign}
                onChange={(e) => set("marketingCampaign", e.target.value)}
                placeholder="Nome da campanha"
                data-testid="input-marketing-campaign"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de Entrada">
              <DatePickerField
                value={values.entryDate}
                onChange={(v) => set("entryDate", v)}
                placeholder="Selecione a data"
                data-testid="datepicker-entry-date"
              />
            </Field>
            <Field label="Responsável pelo Lead">
              <Input
                value={values.responsiblePerson}
                onChange={(e) => set("responsiblePerson", e.target.value)}
                placeholder="Nome do responsável"
                data-testid="input-responsible-person"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status do Lead">
              <SelectField
                value={values.leadStatus}
                onChange={(v) => set("leadStatus", v)}
                options={leadStatusOptions}
                testId="select-lead-status"
              />
            </Field>
            <Field label="Prioridade">
              <SelectField
                value={values.priority}
                onChange={(v) => set("priority", v)}
                options={PRIORITY_OPTIONS}
                testId="select-priority"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Próximo Follow-up">
              <DatePickerField
                value={values.nextFollowUpAt}
                onChange={(v) => set("nextFollowUpAt", v)}
                placeholder="Selecione a data"
                data-testid="datepicker-next-follow-up"
              />
            </Field>
            <Field label="Valor Estimado (R$)">
              <Input
                type="number"
                value={values.estimatedValue}
                onChange={(e) => set("estimatedValue", e.target.value)}
                placeholder="0,00"
                data-testid="input-estimated-value"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Temperatura">
              <SelectField
                value={values.temperature}
                onChange={(v) => set("temperature", v)}
                options={TEMPERATURE_OPTIONS}
                testId="select-temperature"
              />
            </Field>
          </div>

          {/* ══════════════════════════════════════
              EVENT DETAILS
          ══════════════════════════════════════ */}
          {showEvent && (
            <>
              <SectionHeader title="Detalhes do Evento" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome do Evento">
                  <Input
                    value={values.event!.eventName}
                    onChange={(e) => setEvent("eventName", e.target.value)}
                    data-testid="input-event-name"
                  />
                </Field>
                <Field label="Tipo de Evento">
                  <SelectField
                    value={values.event!.eventType}
                    onChange={(v) => setEvent("eventType", v)}
                    options={EVENT_TYPE_OPTIONS}
                    testId="select-event-type"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Data do Evento">
                  <DatePickerField
                    value={values.event!.eventDate}
                    onChange={(v) => setEvent("eventDate", v)}
                    placeholder="Selecione a data"
                    data-testid="datepicker-event-date"
                  />
                </Field>
                <Field label="Local do Evento">
                  <Input
                    value={values.event!.eventVenue}
                    onChange={(e) => setEvent("eventVenue", e.target.value)}
                    data-testid="input-event-venue"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Cidade">
                  <Input
                    value={values.event!.city}
                    onChange={(e) => setEvent("city", e.target.value)}
                    data-testid="input-event-city"
                  />
                </Field>
                <Field label="Estado (UF)">
                  <SelectField
                    value={values.event!.state}
                    onChange={(v) => setEvent("state", v)}
                    options={BR_STATES.map((stateCode) => ({ value: stateCode, label: stateCode }))}
                    placeholder="UF"
                    testId="select-event-state"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Capacidade de Público">
                  <Input
                    value={values.event!.audienceCapacity}
                    onChange={(e) => setEvent("audienceCapacity", e.target.value)}
                    placeholder="Ex: 5000"
                    data-testid="input-event-capacity"
                  />
                </Field>
                {showArtistBandEvent && (
                  <Field label="Nome do Artista / Banda">
                    <Input
                      value={values.event!.artistName}
                      onChange={(e) => setEvent("artistName", e.target.value)}
                      data-testid="input-event-artist"
                    />
                  </Field>
                )}
              </div>

              <Field label="Necessidades Adicionais">
                <Textarea
                  value={values.event!.additionalNeeds}
                  onChange={(e) => setEvent("additionalNeeds", e.target.value)}
                  placeholder="Descreva as necessidades adicionais do evento..."
                  data-testid="textarea-event-needs"
                />
              </Field>
            </>
          )}

          {/* ══════════════════════════════════════
              CAMPAIGN DETAILS
          ══════════════════════════════════════ */}
          {showCampaign && (
            <>
              <SectionHeader title="Detalhes da Campanha" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome da Campanha">
                  <Input
                    value={values.campaign!.campaignName}
                    onChange={(e) => setCampaign("campaignName", e.target.value)}
                    data-testid="input-campaign-name"
                  />
                </Field>
                <Field label="Tipo da Campanha">
                  <Input
                    value={values.campaign!.campaignType}
                    onChange={(e) => setCampaign("campaignType", e.target.value)}
                    data-testid="input-campaign-type"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Data de Início">
                  <DatePickerField
                    value={values.campaign!.start_date}
                    onChange={(v) => setCampaign("start_date", v)}
                    placeholder="Selecione a data"
                    data-testid="datepicker-campaign-start"
                  />
                </Field>
                <Field label="Data de Fim">
                  <DatePickerField
                    value={values.campaign!.end_date}
                    onChange={(v) => setCampaign("end_date", v)}
                    placeholder="Selecione a data"
                    data-testid="datepicker-campaign-end"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Cidade">
                  <Input
                    value={values.campaign!.city}
                    onChange={(e) => setCampaign("city", e.target.value)}
                    data-testid="input-campaign-city"
                  />
                </Field>
                <Field label="Estado (UF)">
                  <SelectField
                    value={values.campaign!.state}
                    onChange={(v) => setCampaign("state", v)}
                    options={BR_STATES.map((stateCode) => ({ value: stateCode, label: stateCode }))}
                    placeholder="UF"
                    testId="select-campaign-state"
                  />
                </Field>
              </div>

              <Field label="Nome do Artista / Banda">
                <Input
                  value={values.campaign!.artistName}
                  onChange={(e) => setCampaign("artistName", e.target.value)}
                  data-testid="input-campaign-artist"
                />
              </Field>

              <Field label="Necessidades Adicionais">
                <Textarea
                  value={values.campaign!.additionalNeeds}
                  onChange={(e) => setCampaign("additionalNeeds", e.target.value)}
                  placeholder="Descreva as necessidades adicionais da campanha..."
                  data-testid="textarea-campaign-needs"
                />
              </Field>
            </>
          )}

          {/* ══════════════════════════════════════
              INFLUENCER DETAILS
          ══════════════════════════════════════ */}
          {showInfluencer && (
            <>
              <SectionHeader title="Detalhes do Influenciador" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome da Campanha">
                  <Input
                    value={values.influencer!.campaignName}
                    onChange={(e) => setInfluencer("campaignName", e.target.value)}
                    data-testid="input-influencer-campaign"
                  />
                </Field>
                <Field label="Tipo da Campanha">
                  <Input
                    value={values.influencer!.campaignType}
                    onChange={(e) => setInfluencer("campaignType", e.target.value)}
                    data-testid="input-influencer-type"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Local da Campanha">
                  <Input
                    value={values.influencer!.campaignLocation}
                    onChange={(e) => setInfluencer("campaignLocation", e.target.value)}
                    data-testid="input-influencer-venue"
                  />
                </Field>
                <Field label="Data">
                  <DatePickerField
                    value={values.influencer!.date}
                    onChange={(v) => setInfluencer("date", v)}
                    placeholder="Selecione a data"
                    data-testid="datepicker-influencer-date"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Cidade">
                  <Input
                    value={values.influencer!.city}
                    onChange={(e) => setInfluencer("city", e.target.value)}
                    data-testid="input-influencer-city"
                  />
                </Field>
                <Field label="Estado (UF)">
                  <SelectField
                    value={values.influencer!.state}
                    onChange={(v) => setInfluencer("state", v)}
                    options={BR_STATES.map((stateCode) => ({ value: stateCode, label: stateCode }))}
                    placeholder="UF"
                    testId="select-influencer-state"
                  />
                </Field>
              </div>

              <Field label="Necessidades Adicionais">
                <Textarea
                  value={values.influencer!.additionalNeeds}
                  onChange={(e) =>
                    setInfluencer("additionalNeeds", e.target.value)
                  }
                  placeholder="Descreva as necessidades adicionais..."
                  data-testid="textarea-influencer-needs"
                />
              </Field>
            </>
          )}

          {/* ══════════════════════════════════════
              ARTIST MANAGER DETAILS
          ══════════════════════════════════════ */}
          {showManager && (
            <>
              <SectionHeader title="Detalhes do Empresário Artístico" />

              <Field label="Nome do Artista / Banda">
                <Input
                  value={values.manager!.artistName}
                  onChange={(e) => setManager("artistName", e.target.value)}
                  data-testid="input-manager-artist"
                />
              </Field>

              <Field label="Necessidades Adicionais">
                <Textarea
                  value={values.manager!.additionalNeeds}
                  onChange={(e) => setManager("additionalNeeds", e.target.value)}
                  placeholder="Descreva as necessidades adicionais..."
                  data-testid="textarea-manager-needs"
                />
              </Field>
            </>
          )}

          {/* ══════════════════════════════════════
              INTERACTION HISTORY
          ══════════════════════════════════════ */}
          <SectionHeader title="Anexos" />
          <div className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Arquivos do lead</p>
                <p className="text-xs text-muted-foreground">
                  Contratos, propostas, documentos ou evidências recebidas no atendimento.
                </p>
              </div>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">
                <Upload className="h-3.5 w-3.5" />
                Anexar arquivos
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void addUploads(event.target.files);
                    event.target.value = "";
                  }}
                  data-testid="input-lead-uploads"
                />
              </label>
            </div>
            {values.uploads.length === 0 ? (
              <p className="text-sm italic text-muted-foreground" data-testid="lead-uploads-empty">
                Nenhum anexo adicionado.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2" data-testid="lead-uploads-list">
                {values.uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{upload.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {upload.extension || upload.mimeType} - {(upload.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUpload(upload.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${upload.fileName}`}
                      data-testid={`button-remove-upload-${upload.id}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-b pb-1 pt-2">
            <p className="text-sm font-semibold tracking-wider text-muted-foreground">
              Histórico de Interações
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addInteraction}
              data-testid="button-add-interaction"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar interação
            </Button>
          </div>

          {values.interactions.length === 0 && (
            <p
              className="text-sm text-muted-foreground italic"
              data-testid="interactions-empty"
            >
              Nenhuma interação registrada.
            </p>
          )}

          {values.interactions.map((it, idx) => (
            <div
              key={it.id}
              className="rounded-md border bg-muted/20 p-4 space-y-3"
              data-testid={`interaction-card-${it.id}`}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Interação {idx + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeInteraction(it.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover interação"
                  data-testid={`button-remove-interaction-${it.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Tipo">
                  <SelectField
                    value={it.type}
                    onChange={(v) => updateInteraction(it.id, "type", v)}
                    options={INTERACTION_TYPE_OPTIONS}
                    testId={`select-interaction-type-${it.id}`}
                  />
                </Field>
                <Field label="Data">
                  <DatePickerField
                    value={it.date}
                    onChange={(v) => updateInteraction(it.id, "date", v)}
                    placeholder="Selecione a data"
                    data-testid={`datepicker-interaction-${it.id}`}
                  />
                </Field>
                <Field label="Horário">
                  <Input
                    type="time"
                    value={it.time}
                    onChange={(e) => updateInteraction(it.id, "time", e.target.value)}
                    data-testid={`input-interaction-time-${it.id}`}
                  />
                </Field>
              </div>

              <Field label="Descrição">
                <Textarea
                  value={it.description}
                  onChange={(e) => updateInteraction(it.id, "description", e.target.value)}
                  placeholder="Descreva a interação..."
                  className="min-h-[80px]"
                  data-testid={`textarea-interaction-${it.id}`}
                />
              </Field>
            </div>
          ))}

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="button-submit"
          >
            {submitting
              ? "Salvando..."
              : mode === "create"
              ? "Criar Lead"
              : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
