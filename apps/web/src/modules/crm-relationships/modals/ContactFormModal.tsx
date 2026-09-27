// ============================================================================
// ContactFormModal — create/edit a Contact (individual or legal entity).
// ----------------------------------------------------------------------------
// IMPORTANT: some fields below (foto, interacoes, funcao/cargo_responsavel,
// cep/logradouro/numero/complemento/bairro, status_contato, prioridade,
// responsavel_*) do NOT exist as dedicated columns in the current `contatos` table.
// They are persisted via the Contact's `payloadOperacional jsonb` (structural
// compat). Turning them into their own columns requires a schema evolution in the
// backend.
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
import { fetchAddressByCEP, maskCEP, maskCNPJ, maskCPF, maskPhone } from "@/shared/lib/masks";
import { contactPriorityOptions, contactStatusOptions } from "../constants";
import {
  CONTACT_TYPE_OPTIONS,
  CONTACT_CATEGORY_OPTIONS,
  getProfiles,
  ensureProfileOption,
} from "../constants/contact-classification";
import { BR_STATES } from "../shared/brazilian-states";
import { INTERACTION_TYPE_OPTIONS, type Interaction } from "../shared/interactions";
import type { ContactAttachment } from "../types";


// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type PersonType = "pessoa_fisica" | "pessoa_juridica";

export type ContactFormState = {
  tipo_pessoa: PersonType;

  // Individual (natural person)
  nome_pf: string;
  cpf: string;
  funcao: string;
  instagram: string;
  foto: string; // data URL or external URL

  // Legal entity (company)
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;

  // Hierarchical classification
  categoria: string; // relacionamento → Contact.contactType
  perfil: string;    // specific profile → payloadOperacional.perfil
  email: string;
  telefone: string;

  // Address
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;

  // Classification
  status_contato: string;
  prioridade_contato: string;

  // Responsible person (human reference)
  responsavel_nome: string;
  responsavel_email: string;
  responsavel_telefone: string;
  responsavel_cargo: string;

  // History
  interacoes: Interaction[];
  attachments: ContactAttachment[];

  // Notes
  observacoes: string;
};

/**
 * Final payload emitted by the modal.
 * Carries ALL form fields + legacy aliases (`nome`, `cpf_cnpj`,
 * `endereco`, `responsavel`, `status`) for compatibility with old
 * consumers (`addClient.mutate`, etc.).
 */
export type ContactFormPayload = ContactFormState & {
  // Aliases legados
  nome: string;
  cpf_cnpj: string;
  endereco: string;
  endereco_completo: string;
  responsavel: string;
  status: string;
  prioridade: string;
  /** Responsible person's position (legacy alias of responsavel_cargo, used by the Leads contacts panel). */
  cargo_responsavel?: string;
};

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValue?: Partial<ContactFormPayload> | null;
  onSubmit?: (payload: ContactFormPayload) => void | Promise<void>;
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

const DEFAULTS: ContactFormState = {
  tipo_pessoa: "pessoa_fisica",
  nome_pf: "",
  cpf: "",
  funcao: "",
  instagram: "",
  foto: "",
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  categoria: "",
  perfil: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  status_contato: "active",
  prioridade_contato: "medium",
  responsavel_nome: "",
  responsavel_email: "",
  responsavel_telefone: "",
  responsavel_cargo: "",
  interacoes: [],
  attachments: [],
  observacoes: "",
};

const buildDefaults = (initial?: Partial<ContactFormPayload> | null): ContactFormState => {
  if (!initial) return { ...DEFAULTS };
  return {
    ...DEFAULTS,
    ...Object.fromEntries(
      Object.entries(initial).filter(([key]) => key in DEFAULTS),
    ),
  } as ContactFormState;
};

const buildAddress = (s: ContactFormState) => {
  const linha1 = [s.logradouro, s.numero].filter(Boolean).join(", ");
  const linha2 = [linha1, s.complemento].filter(Boolean).join(" - ");
  return [linha2, s.bairro].filter(Boolean).join(" / ");
};

const buildFullAddress = (s: ContactFormState) => {
  const base = buildAddress(s);
  const cityState = [s.cidade, s.estado].filter(Boolean).join(" - ");
  const cep = s.cep ? `CEP ${s.cep}` : "";
  return [base, cityState, cep].filter(Boolean).join(" · ");
};

const deriveName = (s: ContactFormState) =>
  s.tipo_pessoa === "pessoa_fisica" ? s.nome_pf : (s.nome_fantasia || s.razao_social);

const deriveCpfCnpj = (s: ContactFormState) =>
  s.tipo_pessoa === "pessoa_fisica" ? s.cpf : s.cnpj;

const buildPayload = (s: ContactFormState): ContactFormPayload => ({
  ...s,
  nome: deriveName(s),
  cpf_cnpj: deriveCpfCnpj(s),
  endereco: buildAddress(s),
  endereco_completo: buildFullAddress(s),
  responsavel: s.responsavel_nome,
  status: s.status_contato,
  prioridade: s.prioridade_contato,
});

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
  const [state, setState] = useState<ContactFormState>(() => buildDefaults(initialValue));
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  // Serializes initialValue into a stable string — ensures the form
  // repopulates even when editing different contacts with the modal already open.
  const initialKey = open ? JSON.stringify(initialValue) : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setState(buildDefaults(initialValue)); }, [open, initialKey]);

  const set = <K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) =>
    setState((prev) => ({ ...prev, [field]: value }));

  const isPF = state.tipo_pessoa === "pessoa_fisica";
  const isPJ = state.tipo_pessoa === "pessoa_juridica";

  // Hierarchical classification (config-driven, em cascata)
  const profileOptions = ensureProfileOption(getProfiles(state.tipo_pessoa, state.categoria), state.perfil);

  const changeType = (value: ContactFormState["tipo_pessoa"]) =>
    setState((prev) => ({ ...prev, tipo_pessoa: value, categoria: "", perfil: "" }));
  const changeCategory = (value: string) =>
    setState((prev) => ({ ...prev, categoria: value, perfil: "" }));

  // Automatic lookup by CEP (postal code)
  const handleCepBlur = async () => {
    const digits = state.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      setCepLoading(true);
      const data = await fetchAddressByCEP(digits);
      if (!data) return;
      setState((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        estado: data.uf || prev.estado,
        complemento: prev.complemento || data.complemento || "",
      }));
    } finally {
      setCepLoading(false);
    }
  };

  // Photo: file → data URL
  const handleFotoSelect = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") set("foto", result);
    };
    reader.readAsDataURL(file);
  };

  // Interactions
  const addInteraction = () => {
    const newInteraction: Interaction = { id: newId(), type: "whatsapp", data: todayISO(), horario: nowTime(), descricao: "" };
    setState((prev) => ({ ...prev, interacoes: [...prev.interacoes, newInteraction] }));
  };
  const updateInteraction = <K extends keyof Interaction>(id: string, field: K, value: Interaction[K]) => {
    setState((prev) => ({
      ...prev,
      interacoes: prev.interacoes.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    }));
  };
  const removeInteraction = (id: string) => {
    setState((prev) => ({ ...prev, interacoes: prev.interacoes.filter((i) => i.id !== id) }));
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
    () => Boolean(deriveName(state).trim()) && Boolean(state.categoria) && Boolean(state.perfil),
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
      await onSubmit(buildPayload(state));
      onOpenChange(false);
    } catch (err) {
      if (handleConcurrencyConflict(err, "contato")) return;
      toast.error("Erro ao salvar contato. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reusable sections (same content for individual/legal entity) ────────────
  const renderClassificacao = () => (
    <>
      <SectionHeader title="Classificação" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Status do Contato">
          <Select value={state.status_contato} onValueChange={(v) => set("status_contato", v)}>
            <SelectTrigger data-testid="select-status"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {contactStatusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Prioridade">
          <Select value={state.prioridade_contato} onValueChange={(v) => set("prioridade_contato", v)}>
            <SelectTrigger data-testid="select-prioridade"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
        <Button type="button" variant="outline" size="sm" onClick={addInteraction} data-testid="button-add-interacao">
          <Plus className="h-4 w-4 mr-1" />
          Adicionar interação
        </Button>
      </div>
      {state.interacoes.length === 0 && (
        <p className="text-sm italic text-muted-foreground" data-testid="interacoes-empty">Nenhuma interação registrada.</p>
      )}
      {state.interacoes.map((it, idx) => (
        <div key={it.id} className="rounded-md border bg-muted/20 p-4 space-y-3" data-testid={`interacao-card-${it.id}`}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Interação {idx + 1}
            </p>
            <button type="button" onClick={() => removeInteraction(it.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remover interação" data-testid={`button-remove-interacao-${it.id}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo">
              <Select value={it.type} onValueChange={(v) => updateInteraction(it.id, "type", v)}>
                <SelectTrigger data-testid={`select-interacao-type-${it.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data">
              <DatePickerField value={it.data} onChange={(v) => updateInteraction(it.id, "data", v)} placeholder="Selecione a data" data-testid={`datepicker-interacao-${it.id}`} />
            </Field>
            <Field label="Horário">
              <Input type="time" value={it.horario} onChange={(e) => updateInteraction(it.id, "horario", e.target.value)} data-testid={`input-interacao-horario-${it.id}`} />
            </Field>
          </div>
          <Field label="Descrição">
            <Textarea value={it.descricao} onChange={(e) => updateInteraction(it.id, "descricao", e.target.value)} placeholder="Descreva a interação..." className="min-h-[80px]" data-testid={`textarea-interacao-${it.id}`} />
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
            <input type="file" multiple className="hidden" onChange={(event) => { addAttachments(event.target.files); event.target.value = ""; }} data-testid="input-contato-attachments" />
          </label>
        </div>
        {state.attachments.length === 0 ? (
          <p className="text-sm italic text-muted-foreground" data-testid="contato-attachments-empty">Nenhum anexo adicionado.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" data-testid="contato-attachments-list">
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
        <Textarea value={state.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Anotações sobre o contato, contexto operacional, histórico relevante..." className="min-h-[100px]" data-testid="textarea-observacoes" />
      </Field>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="contato-form-modal">
        <DialogHeader>
          <DialogTitle data-testid="contato-form-title">
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
              <Select value={state.tipo_pessoa} onValueChange={(v) => changeType(v as ContactFormState["tipo_pessoa"])}>
                <SelectTrigger data-testid="select-type-contato">
                  <SelectValue placeholder="Selecione o Tipo de Contato" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Categoria *">
              <Select value={state.categoria} onValueChange={changeCategory} disabled={!state.tipo_pessoa}>
                <SelectTrigger data-testid="select-categoria">
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
              <Select value={state.perfil} onValueChange={(v) => set("perfil", v)} disabled={!state.categoria}>
                <SelectTrigger data-testid="select-perfil">
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
          <SectionHeader title={isPF ? "Dados da Pessoa Física" : "Dados da Pessoa Jurídica"} />

          {isPF ? (
            <>
              <Field label="Foto">
                <div className="flex items-center gap-3">
                  {state.foto ? (
                    <div className="relative">
                      <img src={state.foto} alt="Foto" className="h-16 w-16 rounded-full object-cover" />
                      <button
                        type="button"
                        onClick={() => set("foto", "")}
                        className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        aria-label="Remover foto"
                        data-testid="button-remove-foto"
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
                    {state.foto ? "Trocar foto" : "Selecionar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFotoSelect(e.target.files?.[0] ?? null)}
                      data-testid="input-pf-foto"
                    />
                  </label>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome completo *">
                  <Input
                    value={state.nome_pf}
                    onChange={(e) => set("nome_pf", e.target.value)}
                    placeholder="Nome da pessoa"
                    data-testid="input-pf-nome"
                  />
                </Field>
                <Field label="CPF">
                  <Input
                    value={state.cpf}
                    onChange={(e) => set("cpf", maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    data-testid="input-pf-cpf"
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
                    value={state.telefone}
                    onChange={(e) => set("telefone", maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    data-testid="input-telefone"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Instagram">
                  <Input
                    value={state.instagram}
                    onChange={(e) => set("instagram", e.target.value)}
                    placeholder="@usuario"
                    data-testid="input-pf-instagram"
                  />
                </Field>
                <Field label="Função">
                  <Input
                    value={state.funcao}
                    onChange={(e) => set("funcao", e.target.value)}
                    placeholder="Ex: produtor, técnico, fotógrafo"
                    data-testid="input-pf-funcao"
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Razão Social *">
                  <Input
                    value={state.razao_social}
                    onChange={(e) => set("razao_social", e.target.value)}
                    placeholder="Razão social da empresa"
                    data-testid="input-pj-razao-social"
                  />
                </Field>
                <Field label="Nome Fantasia">
                  <Input
                    value={state.nome_fantasia}
                    onChange={(e) => set("nome_fantasia", e.target.value)}
                    placeholder="Nome fantasia"
                    data-testid="input-pj-nome-fantasia"
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
                    value={state.telefone}
                    onChange={(e) => set("telefone", maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    data-testid="input-telefone"
                  />
                </Field>
              </div>
            </>
          )}

          {/* ADDRESS (same order for individual and legal entity) ========== */}
          <SectionHeader title="Endereço" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Logradouro">
              <Input value={state.logradouro} onChange={(e) => set("logradouro", e.target.value)} placeholder="Rua, avenida..." data-testid="input-logradouro" />
            </Field>
            <Field label="Número">
              <Input value={state.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Ex: 123" data-testid="input-numero" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Complemento">
              <Input value={state.complemento} onChange={(e) => set("complemento", e.target.value)} placeholder="Apto, sala, bloco..." data-testid="input-complemento" />
            </Field>
            <Field label="Bairro">
              <Input value={state.bairro} onChange={(e) => set("bairro", e.target.value)} placeholder="Bairro" data-testid="input-bairro" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cidade">
              <Input value={state.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade" data-testid="input-cidade" />
            </Field>
            <Field label="Estado">
              <Select value={state.estado} onValueChange={(v) => set("estado", v)}>
                <SelectTrigger data-testid="select-estado"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{BR_STATES.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CEP">
              <Input value={state.cep} onChange={(e) => set("cep", maskCEP(e.target.value))} onBlur={handleCepBlur} placeholder="00000-000" data-testid="input-cep" />
              {cepLoading && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
            </Field>
          </div>

          {renderClassificacao()}

          {/* RESPONSIBLE PERSON — shown only for legal entities ============ */}
          {isPJ && (
            <>
              <SectionHeader title="Responsável" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome do Responsável">
                  <Input
                    value={state.responsavel_nome}
                    onChange={(e) => set("responsavel_nome", e.target.value)}
                    placeholder="Nome de quem cuida do relacionamento"
                    data-testid="input-resp-nome"
                  />
                </Field>
                <Field label="Cargo do Responsável">
                  <Input
                    value={state.responsavel_cargo}
                    onChange={(e) => set("responsavel_cargo", e.target.value)}
                    placeholder="Cargo na sua equipe"
                    data-testid="input-resp-cargo"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="E-mail do responsável">
                  <Input
                    type="email"
                    value={state.responsavel_email}
                    onChange={(e) => set("responsavel_email", e.target.value)}
                    placeholder="email@empresa.com"
                    data-testid="input-resp-email"
                  />
                </Field>
                <Field label="Telefone do Responsável">
                  <Input
                    value={state.responsavel_telefone}
                    onChange={(e) => set("responsavel_telefone", maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    data-testid="input-resp-telefone"
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
