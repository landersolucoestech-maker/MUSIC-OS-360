// ============================================================================
// ContactFormModal — create/edit a Contact (individual or company).
// ----------------------------------------------------------------------------
// Every field maps 1:1 to its own `clients` column (CZ-043); the conversion to
// a Contact lives in ../services/contacts.service.ts (contactFormToContactInput
// / contactToFormValues). Technical identifiers are English; every text the
// user sees is PT-BR.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Plus, Trash2, Upload, X } from "lucide-react";
import { handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { addressFromPostalLookup, fetchAddressByCEP, maskCEP, maskCNPJ, maskCPF, maskPhone } from "@/shared/lib/masks";
import { contactPriorityOptions, contactStatusOptions } from "../constants";
import {
  PERSON_TYPE_OPTIONS,
  CONTACT_CATEGORY_OPTIONS,
  getProfiles,
  ensureProfileOption,
} from "../constants/contact-classification";
import { BR_STATES } from "../shared/brazilian-states";
import { INTERACTION_TYPE_OPTIONS, type Interaction } from "../shared/interactions";
import { deriveContactName } from "../services/contacts.service";
import type { ContactAttachment, ContactPriority, ContactStatus, PersonType } from "../types";


// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ContactFormValues = {
  personType: PersonType;

  // Individual
  individualName: string;
  cpf: string;
  jobTitle: string;
  instagram: string;
  photoUrl: string; // data URL or external URL

  // Company
  legalName: string;
  tradeName: string;
  cnpj: string;

  // Hierarchical classification
  category: string; // relationship → Contact.category
  profile: string;  // specific profile → Contact.profile
  email: string;
  phone: string;

  // Address
  zipCode: string;
  street: string;
  streetNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;

  // Classification
  status: ContactStatus;
  priority: ContactPriority;

  // Responsible person (human reference)
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  responsibleJobTitle: string;

  // History
  interactions: Interaction[];
  attachments: ContactAttachment[];

  // Notes
  notes: string;
};

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValue?: Partial<ContactFormValues> | null;
  onSubmit?: (values: ContactFormValues) => void | Promise<void>;
}

// ----------------------------------------------------------------------------
// Defaults & helpers
// ----------------------------------------------------------------------------

const todayISO = () => new Date().toISOString().split("T")[0];
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const DEFAULTS: ContactFormValues = {
  personType: "individual",
  individualName: "",
  cpf: "",
  jobTitle: "",
  instagram: "",
  photoUrl: "",
  legalName: "",
  tradeName: "",
  cnpj: "",
  category: "",
  profile: "",
  email: "",
  phone: "",
  zipCode: "",
  street: "",
  streetNumber: "",
  addressComplement: "",
  neighborhood: "",
  city: "",
  state: "",
  status: "active",
  priority: "medium",
  responsibleName: "",
  responsibleEmail: "",
  responsiblePhone: "",
  responsibleJobTitle: "",
  interactions: [],
  attachments: [],
  notes: "",
};

const buildDefaults = (initial?: Partial<ContactFormValues> | null): ContactFormValues => {
  if (!initial) return { ...DEFAULTS };
  return {
    ...DEFAULTS,
    ...Object.fromEntries(
      Object.entries(initial).filter(([key, value]) => key in DEFAULTS && value !== undefined),
    ),
  } as ContactFormValues;
};

// ----------------------------------------------------------------------------
// Internal UI subcomponents
// ----------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-sm font-semibold tracking-wider text-muted-foreground border-b pb-1 pt-2">
      {title}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------------

export function ContactFormModal({ open, onOpenChange, mode, initialValue, onSubmit }: ContactFormModalProps) {
  const [state, setState] = useState<ContactFormValues>(() => buildDefaults(initialValue));
  const [submitting, setSubmitting] = useState(false);
  const [zipCodeLoading, setZipCodeLoading] = useState(false);

  // Serializes initialValue into a stable string — ensures the form
  // repopulates even when editing different contacts with the modal already open.
  const initialKey = open ? JSON.stringify(initialValue) : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setState(buildDefaults(initialValue)); }, [open, initialKey]);

  const set = <K extends keyof ContactFormValues>(field: K, value: ContactFormValues[K]) =>
    setState((prev) => ({ ...prev, [field]: value }));

  const isIndividual = state.personType === "individual";
  const isCompany = state.personType === "company";

  // Hierarchical classification (config-driven, cascading)
  const profileOptions = ensureProfileOption(getProfiles(state.personType, state.category), state.profile);

  const changeType = (value: PersonType) =>
    setState((prev) => ({ ...prev, personType: value, category: "", profile: "" }));
  const changeCategory = (value: string) =>
    setState((prev) => ({ ...prev, category: value, profile: "" }));

  // Automatic lookup by CEP (postal code)
  const handleZipCodeBlur = async () => {
    const digits = state.zipCode.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      setZipCodeLoading(true);
      const data = await fetchAddressByCEP(digits);
      if (!data) return;
      setState((prev) => ({ ...prev, ...addressFromPostalLookup(data, prev) }));
    } finally {
      setZipCodeLoading(false);
    }
  };

  // Photo: file → data URL
  const handlePhotoSelect = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") set("photoUrl", result);
    };
    reader.readAsDataURL(file);
  };

  // Interactions
  const addInteraction = () => {
    const newInteraction: Interaction = { id: newId(), type: "whatsapp", date: todayISO(), time: nowTime(), description: "" };
    setState((prev) => ({ ...prev, interactions: [...prev.interactions, newInteraction] }));
  };
  const updateInteraction = <K extends keyof Interaction>(id: string, field: K, value: Interaction[K]) => {
    setState((prev) => ({
      ...prev,
      interactions: prev.interactions.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    }));
  };
  const removeInteraction = (id: string) => {
    setState((prev) => ({ ...prev, interactions: prev.interactions.filter((i) => i.id !== id) }));
  };

  const addAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    const nextAttachments: ContactAttachment[] = Array.from(files).map((file) => {
      const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
      return {
        id: newId(),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        extension,
        url: URL.createObjectURL(file),
        createdAt: new Date().toISOString(),
      };
    });
    setState((prev) => ({ ...prev, attachments: [...prev.attachments, ...nextAttachments] }));
  };

  const removeAttachment = (id: string) => {
    setState((prev) => ({ ...prev, attachments: prev.attachments.filter((attachment) => attachment.id !== id) }));
  };

  // Validation — derived name + complete classification (category + profile)
  const isValid = useMemo(
    () => Boolean(deriveContactName(state).trim()) && Boolean(state.category) && Boolean(state.profile),
    [state],
  );

  const handleSubmit = async () => {
    if (!isValid) return;
    if (!onSubmit) {
      onOpenChange(false);
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit(state);
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "contato")) return;
      toast.error("Erro ao salvar contato. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reusable sections (same content for individual/legal entity) ────────────
  const renderClassification = () => (
    <>
      <SectionHeader title="Classificação" />
      <div className="grid grid-cols-2 gap-4">
        {/* POST /clients does not accept `status` — a new contact starts "Ativo"; it is editable afterwards. */}
        {mode === "edit" && (
        <Field label="Status do Contato">
          <Select value={state.status} onValueChange={(v) => set("status", v as ContactStatus)}>
            <SelectTrigger data-testid="select-status"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {contactStatusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        )}
        <Field label="Prioridade">
          <Select value={state.priority} onValueChange={(v) => set("priority", v as ContactPriority)}>
            <SelectTrigger data-testid="select-priority"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {contactPriorityOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </>
  );

  const renderHistory = () => (
    <>
      <div className="flex items-center justify-between border-b pb-1 pt-2">
        <p className="text-sm font-semibold tracking-wider text-muted-foreground">Histórico de Interações</p>
        <Button type="button" variant="outline" size="sm" onClick={addInteraction} data-testid="button-add-interaction">
          <Plus className="h-4 w-4 mr-1" />
          Adicionar interação
        </Button>
      </div>
      {state.interactions.length === 0 && (
        <p className="text-sm italic text-muted-foreground" data-testid="interactions-empty">Nenhuma interação registrada.</p>
      )}
      {state.interactions.map((it, idx) => (
        <div key={it.id} className="rounded-md border bg-muted/20 p-4 space-y-3" data-testid={`interaction-card-${it.id}`}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Interação {idx + 1}
            </p>
            <button type="button" onClick={() => removeInteraction(it.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remover interação" data-testid={`button-remove-interaction-${it.id}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo">
              <Select value={it.type} onValueChange={(v) => updateInteraction(it.id, "type", v)}>
                <SelectTrigger data-testid={`select-interaction-type-${it.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <DatePickerField value={it.date} onChange={(v) => updateInteraction(it.id, "date", v)} placeholder="Selecione a data" data-testid={`datepicker-interaction-${it.id}`} />
            </Field>
            <Field label="Horário">
              <Input type="time" value={it.time} onChange={(e) => updateInteraction(it.id, "time", e.target.value)} data-testid={`input-interaction-time-${it.id}`} />
            </Field>
          </div>
          <Field label="Descrição">
            <Textarea value={it.description} onChange={(e) => updateInteraction(it.id, "description", e.target.value)} placeholder="Descreva a interação..." className="min-h-[80px]" data-testid={`textarea-interaction-${it.id}`} />
          </Field>
        </div>
      ))}
    </>
  );

  const renderAttachments = () => (
    <>
      <SectionHeader title="Anexos" />
      <div className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Arquivos do contato</p>
            <p className="text-xs text-muted-foreground">Documentos, propostas, contratos ou arquivos relacionados ao relacionamento.</p>
          </div>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">
            <Upload className="h-3.5 w-3.5" />
            Anexar arquivos
            <input type="file" multiple className="hidden" onChange={(event) => { addAttachments(event.target.files); event.target.value = ""; }} data-testid="input-contact-attachments" />
          </label>
        </div>
        {state.attachments.length === 0 ? (
          <p className="text-sm italic text-muted-foreground" data-testid="contact-attachments-empty">Nenhum anexo adicionado.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" data-testid="contact-attachments-list">
            {state.attachments.map((attachment) => (
              <div key={attachment.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{attachment.fileName}</p>
                  <p className="text-xs text-muted-foreground">{attachment.extension || attachment.mimeType} - {(attachment.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={() => removeAttachment(attachment.id)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remover ${attachment.fileName}`} data-testid={`button-remove-attachment-${attachment.id}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const renderNotes = () => (
    <>
      <SectionHeader title="Observações" />
      <Field label="Notas">
        <Textarea value={state.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anotações sobre o contato, contexto operacional, histórico relevante..." className="min-h-[100px]" data-testid="textarea-notes" />
      </Field>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="contact-form-modal">
        <DialogHeader>
          <DialogTitle data-testid="contact-form-title">
            {mode === "create" ? "Novo Contato" : "Editar Contato"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Cadastre um novo contato no relacionamento operacional" : "Edite os dados do contato"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* CONTACT CLASSIFICATION (Type → Category → Profile) ============= */}
          <SectionHeader title="Classificação do Contato" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Tipo de Contato *">
              <Select value={state.personType} onValueChange={(v) => changeType(v as PersonType)}>
                <SelectTrigger data-testid="select-type-contact">
                  <SelectValue placeholder="Selecione o Tipo de Contato" />
                </SelectTrigger>
                <SelectContent>
                  {PERSON_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Categoria *">
              <Select value={state.category} onValueChange={changeCategory} disabled={!state.personType}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Selecione a Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Perfil do Contato *">
              <Select value={state.profile} onValueChange={(v) => set("profile", v)} disabled={!state.category}>
                <SelectTrigger data-testid="select-profile">
                  <SelectValue placeholder="Selecione o Perfil do Contato" />
                </SelectTrigger>
                <SelectContent>
                  {profileOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* CONTACT DETAILS ============================================== */}
          <SectionHeader title={isIndividual ? "Dados da Pessoa Física" : "Dados da Pessoa Jurídica"} />

          {isIndividual ? (
            <>
              <Field label="Foto">
                <div className="flex items-center gap-3">
                  {state.photoUrl ? (
                    <div className="relative">
                      <img src={state.photoUrl} alt="Foto" className="h-16 w-16 rounded-full object-cover" />
                      <button
                        type="button"
                        onClick={() => set("photoUrl", "")}
                        className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        aria-label="Remover foto"
                        data-testid="button-remove-photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <label className="cursor-pointer text-sm text-primary hover:underline">
                    {state.photoUrl ? "Trocar foto" : "Selecionar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)}
                      data-testid="input-individual-photo"
                    />
                  </label>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome completo *">
                  <Input
                    value={state.individualName}
                    onChange={(e) => set("individualName", e.target.value)}
                    placeholder="Nome da pessoa"
                    data-testid="input-individual-name"
                  />
                </Field>
                <Field label="CPF">
                  <Input
                    value={state.cpf}
                    onChange={(e) => set("cpf", maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    data-testid="input-individual-cpf"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={state.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="email@exemplo.com"
                    data-testid="input-email"
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={state.phone}
                    onChange={(e) => set("phone", maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    data-testid="input-phone"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Instagram">
                  <Input
                    value={state.instagram}
                    onChange={(e) => set("instagram", e.target.value)}
                    placeholder="@usuario"
                    data-testid="input-individual-instagram"
                  />
                </Field>
                <Field label="Função">
                  <Input
                    value={state.jobTitle}
                    onChange={(e) => set("jobTitle", e.target.value)}
                    placeholder="Ex: produtor, técnico, fotógrafo"
                    data-testid="input-individual-role"
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Razão Social *">
                  <Input
                    value={state.legalName}
                    onChange={(e) => set("legalName", e.target.value)}
                    placeholder="Razão social da empresa"
                    data-testid="input-pj-legal-name"
                  />
                </Field>
                <Field label="Nome Fantasia">
                  <Input
                    value={state.tradeName}
                    onChange={(e) => set("tradeName", e.target.value)}
                    placeholder="Nome fantasia"
                    data-testid="input-pj-trade-name"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="CNPJ">
                  <Input
                    value={state.cnpj}
                    onChange={(e) => set("cnpj", maskCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    data-testid="input-pj-cnpj"
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={state.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="email@exemplo.com"
                    data-testid="input-email"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Instagram">
                  <Input
                    value={state.instagram}
                    onChange={(e) => set("instagram", e.target.value)}
                    placeholder="@empresa"
                    data-testid="input-pj-instagram"
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={state.phone}
                    onChange={(e) => set("phone", maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    data-testid="input-phone"
                  />
                </Field>
              </div>
            </>
          )}

          {/* ADDRESS (same order for individual and legal entity) ========== */}
          <SectionHeader title="Endereço" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Logradouro">
              <Input value={state.street} onChange={(e) => set("street", e.target.value)} placeholder="Rua, avenida..." data-testid="input-street" />
            </Field>
            <Field label="Número">
              <Input value={state.streetNumber} onChange={(e) => set("streetNumber", e.target.value)} placeholder="Ex: 123" data-testid="input-number" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Complemento">
              <Input value={state.addressComplement} onChange={(e) => set("addressComplement", e.target.value)} placeholder="Apto, sala, bloco..." data-testid="input-complement" />
            </Field>
            <Field label="Bairro">
              <Input value={state.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Bairro" data-testid="input-neighborhood" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cidade">
              <Input value={state.city} onChange={(e) => set("city", e.target.value)} placeholder="Cidade" data-testid="input-city" />
            </Field>
            <Field label="Estado">
              <Select value={state.state} onValueChange={(v) => set("state", v)}>
                <SelectTrigger data-testid="select-state"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{BR_STATES.map((stateCode) => <SelectItem key={stateCode} value={stateCode}>{stateCode}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CEP">
              <Input value={state.zipCode} onChange={(e) => set("zipCode", maskCEP(e.target.value))} onBlur={handleZipCodeBlur} placeholder="00000-000" data-testid="input-postal-code" />
              {zipCodeLoading && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
            </Field>
          </div>

          {renderClassification()}

          {/* RESPONSIBLE PERSON — shown only for legal entities ============ */}
          {isCompany && (
            <>
              <SectionHeader title="Responsável" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome do Responsável">
                  <Input
                    value={state.responsibleName}
                    onChange={(e) => set("responsibleName", e.target.value)}
                    placeholder="Nome de quem cuida do relacionamento"
                    data-testid="input-resp-name"
                  />
                </Field>
                <Field label="Cargo do Responsável">
                  <Input
                    value={state.responsibleJobTitle}
                    onChange={(e) => set("responsibleJobTitle", e.target.value)}
                    placeholder="Cargo na sua equipe"
                    data-testid="input-resp-position"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="E-mail do responsável">
                  <Input
                    type="email"
                    value={state.responsibleEmail}
                    onChange={(e) => set("responsibleEmail", e.target.value)}
                    placeholder="email@empresa.com"
                    data-testid="input-resp-email"
                  />
                </Field>
                <Field label="Telefone do Responsável">
                  <Input
                    value={state.responsiblePhone}
                    onChange={(e) => set("responsiblePhone", maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    data-testid="input-resp-phone"
                  />
                </Field>
              </div>
            </>
          )}

          {/* End (individual and legal entity): Attachments → Notes → History (last) */}
          {renderAttachments()}
          {renderNotes()}
          {renderHistory()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid} data-testid="button-submit">
            {submitting ? "Salvando..." : mode === "create" ? "Criar Contato" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
