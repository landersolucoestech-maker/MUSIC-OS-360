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
  ESTADOS_BR,
  ORIGEM_LEAD_OPTIONS,
  PRIORIDADE_OPTIONS,
  TIPO_EVENTO_OPTIONS,
  TIPO_LEAD_EMPRESARIO,
  TIPO_LEAD_INFLUENCIADOR,
  TIPO_LEAD_OPTIONS,
  getServicosForTipoLead,
  type TipoLead,
} from "../constants/lead-form-options";
import type { LeadUpload } from "../types";

// ─────────────────────────────────────────────
// Interações
// ─────────────────────────────────────────────
export const TIPO_INTERACAO_OPTIONS = [
  { value: "ligacao",    label: "Ligação"    },
  { value: "whatsapp",   label: "WhatsApp"   },
  { value: "email",      label: "Email"      },
  { value: "reuniao",    label: "Reunião"    },
  { value: "proposta",   label: "Proposta"   },
  { value: "follow_up",  label: "Follow-up"  },
  { value: "observacao", label: "Observação" },
] as const;

export const TEMPERATURA_OPTIONS = [
  { value: "frio",   label: "Frio"   },
  { value: "morno",  label: "Morno"  },
  { value: "quente", label: "Quente" },
] as const;

// ─────────────────────────────────────────────
// Regras condicionais por combo type + serviço
// ─────────────────────────────────────────────

const EVENTO_COMBOS: ReadonlyArray<{ type: string; servico: string }> = [
  { type: "marca_empresa",        servico: "eventos_corporativos" },
  { type: "agencia",              servico: "producao_eventos"     },
  { type: "agencia",              servico: "contratacao_artistas" },
  { type: "produtora_eventos",    servico: "contratacao_artistas" },
  { type: "contratante_show",     servico: "contratacao_artistas" },
  { type: "contratante_show",     servico: "eventos_corporativos" },
  { type: "empresario_artistico", servico: "contratacao_artistas" },
  { type: "empresario_artistico", servico: "eventos_corporativos" },
  { type: "influenciador",        servico: "producao_eventos"     },
];

const CAMPANHA_COMBOS: ReadonlyArray<{ type: string; servico: string }> = [
  { type: "marca_empresa", servico: "campanhas_artistas" },
  { type: "agencia",       servico: "campanhas_artistas" },
];

const ARTISTA_EVENTO_COMBOS: ReadonlyArray<{ type: string; servico: string }> = [
  { type: "marca_empresa",        servico: "eventos_corporativos" },
  { type: "agencia",              servico: "producao_eventos"     },
  { type: "agencia",              servico: "contratacao_artistas" },
  { type: "produtora_eventos",    servico: "contratacao_artistas" },
  { type: "contratante_show",     servico: "contratacao_artistas" },
  { type: "contratante_show",     servico: "eventos_corporativos" },
  { type: "empresario_artistico", servico: "contratacao_artistas" },
  { type: "empresario_artistico", servico: "eventos_corporativos" },
];

const matchCombo = (
  list: ReadonlyArray<{ type: string; servico: string }>,
  type: string,
  servico: string,
) => list.some((c) => c.type === type && c.servico === servico);

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export type Interacao = {
  id: string;
  type: string;
  data: string;
  horario: string;
  descricao: string;
};

type CondicionalEventoPayload = {
  nome_evento: string;
  tipo_evento: string;
  data_evento: string;
  local_evento: string;
  cidade: string;
  estado: string;
  capacidade_publico: string;
  nome_artista_banda: string;
  necessidades_adicionais: string;
};

type CondicionalCampanhaPayload = {
  nome_campanha: string;
  tipo_campanha: string;
  start_date: string;
  end_date: string;
  cidade: string;
  estado: string;
  nome_artista_banda: string;
  necessidades_adicionais: string;
};

type CondicionalInfluenciadorPayload = {
  nome_campanha: string;
  tipo_campanha: string;
  local_campanha: string;
  data: string;
  cidade: string;
  estado: string;
  necessidades_adicionais: string;
};

type CondicionalEmpresarioPayload = {
  nome_artista_banda: string;
  necessidades_adicionais: string;
};

export type LeadFormPayload = {
  nome: string;
  empresa: string;
  cargo: string;
  email: string;
  telefone: string;
  instagram: string;
  website: string;
  endereco: string;
  cidade: string;
  estado: string;
  tipo_lead: TipoLead | "";
  servico: string;
  nome_artista_servico: string;
  descricao: string;
  origem_lead: string;
  campanha_marketing: string;
  data_entrada: string;
  status_lead: string;
  prioridade: string;
  responsavel: string;
  proximo_follow_up: string;
  valor_estimado: string;
  temperatura: string;
  evento?: CondicionalEventoPayload;
  campanha?: CondicionalCampanhaPayload;
  influenciador?: CondicionalInfluenciadorPayload;
  empresario?: CondicionalEmpresarioPayload;
  interacoes: Interacao[];
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
const EVENTO_DEFAULT: CondicionalEventoPayload = {
  nome_evento: "", tipo_evento: "", data_evento: "",
  local_evento: "", cidade: "", estado: "",
  capacidade_publico: "", nome_artista_banda: "",
  necessidades_adicionais: "",
};

const CAMPANHA_DEFAULT: CondicionalCampanhaPayload = {
  nome_campanha: "", tipo_campanha: "",
  start_date: "", end_date: "",
  cidade: "", estado: "",
  nome_artista_banda: "", necessidades_adicionais: "",
};

const INFLUENCIADOR_DEFAULT: CondicionalInfluenciadorPayload = {
  nome_campanha: "", tipo_campanha: "", local_campanha: "",
  data: "", cidade: "", estado: "", necessidades_adicionais: "",
};

const EMPRESARIO_DEFAULT: CondicionalEmpresarioPayload = {
  nome_artista_banda: "", necessidades_adicionais: "",
};

const todayISO = () => new Date().toISOString().split("T")[0];

const nowHorario = () => {
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
  nome:                 initial?.nome                 ?? "",
  empresa:              initial?.empresa              ?? "",
  cargo:                initial?.cargo                ?? "",
  email:                initial?.email                ?? "",
  telefone:             initial?.telefone             ?? "",
  instagram:            initial?.instagram            ?? "",
  website:              initial?.website              ?? "",
  endereco:             initial?.endereco             ?? "",
  cidade:               initial?.cidade               ?? "",
  estado:               initial?.estado               ?? "",
  tipo_lead:            (initial?.tipo_lead as TipoLead) ?? "",
  servico:              initial?.servico              ?? "",
  nome_artista_servico: initial?.nome_artista_servico ?? "",
  descricao:            initial?.descricao            ?? "",
  origem_lead:          initial?.origem_lead          ?? "",
  campanha_marketing:   initial?.campanha_marketing   ?? "",
  data_entrada:         initial?.data_entrada         ?? todayISO(),
  status_lead:          initial?.status_lead          ?? "new",
  prioridade:           initial?.prioridade           ?? "media",
  responsavel:          initial?.responsavel          ?? "",
  proximo_follow_up:    initial?.proximo_follow_up    ?? "",
  valor_estimado:       initial?.valor_estimado       ?? "",
  temperatura:          initial?.temperatura          ?? "",
  evento:               initial?.evento               ?? { ...EVENTO_DEFAULT },
  campanha:             initial?.campanha             ?? { ...CAMPANHA_DEFAULT },
  influenciador:        initial?.influenciador        ?? { ...INFLUENCIADOR_DEFAULT },
  empresario:           initial?.empresario           ?? { ...EMPRESARIO_DEFAULT },
  interacoes:           initial?.interacoes           ?? [],
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
// Componente principal
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

  const setEvento = <K extends keyof CondicionalEventoPayload>(
    field: K, value: CondicionalEventoPayload[K],
  ) => setValues((prev) => ({
    ...prev,
    evento: { ...(prev.evento ?? EVENTO_DEFAULT), [field]: value },
  }));

  const setCampanha = <K extends keyof CondicionalCampanhaPayload>(
    field: K, value: CondicionalCampanhaPayload[K],
  ) => setValues((prev) => ({
    ...prev,
    campanha: { ...(prev.campanha ?? CAMPANHA_DEFAULT), [field]: value },
  }));

  const setInfluenciador = <K extends keyof CondicionalInfluenciadorPayload>(
    field: K, value: CondicionalInfluenciadorPayload[K],
  ) => setValues((prev) => ({
    ...prev,
    influenciador: { ...(prev.influenciador ?? INFLUENCIADOR_DEFAULT), [field]: value },
  }));

  const setEmpresario = <K extends keyof CondicionalEmpresarioPayload>(
    field: K, value: CondicionalEmpresarioPayload[K],
  ) => setValues((prev) => ({
    ...prev,
    empresario: { ...(prev.empresario ?? EMPRESARIO_DEFAULT), [field]: value },
  }));

  // ── Interações ───────────────────────────────
  const addInteracao = () => {
    const nova: Interacao = {
      id: newId(), type: "whatsapp",
      data: todayISO(), horario: nowHorario(), descricao: "",
    };
    setValues((prev) => ({ ...prev, interacoes: [...prev.interacoes, nova] }));
  };

  const updateInteracao = <K extends keyof Interacao>(
    id: string, field: K, value: Interacao[K],
  ) => setValues((prev) => ({
    ...prev,
    interacoes: prev.interacoes.map((i) =>
      i.id === id ? { ...i, [field]: value } : i,
    ),
  }));

  const removeInteracao = (id: string) =>
    setValues((prev) => ({
      ...prev,
      interacoes: prev.interacoes.filter((i) => i.id !== id),
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
          ? err.message
          : err instanceof Error ? err.message : "Erro no upload do arquivo";
        toast.error(`${file.name}: ${msg}`);
      }
    }
  };

  const removeUpload = (id: string) =>
    setValues((prev) => ({ ...prev, uploads: prev.uploads.filter((upload) => upload.id !== id) }));

  const type    = values.tipo_lead as TipoLead | "";
  const servico = values.servico;

  const showEvento   = matchCombo(EVENTO_COMBOS,   type, servico);
  const showCampanha = matchCombo(CAMPANHA_COMBOS, type, servico);

  // CORRIGIDO: showInfluenciador e showEmpresario são mutuamente exclusivos com showEvento
  const showInfluenciador = type === TIPO_LEAD_INFLUENCIADOR && !showEvento;
  const showEmpresario    = type === TIPO_LEAD_EMPRESARIO    && !showEvento;

  const showArtistaBandaEvento = matchCombo(ARTISTA_EVENTO_COMBOS, type, servico);

  // Campo artista/influenciador na seção Classificação
  const showArtistaMarcaEmpresa    = type === "marca_empresa"    && servico === "campanhas_artistas";
  const showArtistaBandaEmpresario = type === TIPO_LEAD_EMPRESARIO;
  const showInfluenciadorTipoLead  = type === TIPO_LEAD_INFLUENCIADOR;

  const showCampoArtista =
    showArtistaMarcaEmpresa    ||
    showArtistaBandaEmpresario ||
    showInfluenciadorTipoLead;

  const labelArtista =
    showInfluenciadorTipoLead
      ? "Nome do Influenciador"
      : showArtistaBandaEmpresario
      ? "Nome do Artista / Banda"
      : "Nome do Artista";

  const placeholderArtista =
    showInfluenciadorTipoLead
      ? "Ex: @influenciador"
      : "Ex: João da Silva";

  const servicosDisponiveis = useMemo(
    () => getServicosForTipoLead(type),
    [type],
  );

  // ── Submit ───────────────────────────────────
  const handleSubmit = async () => {
    if (!onSubmit) { onOpenChange(false); return; }
    try {
      setSubmitting(true);
      await onSubmit({
        ...values,
        evento:        showEvento        ? values.evento        : undefined,
        campanha:      showCampanha      ? values.campanha      : undefined,
        influenciador: showInfluenciador ? values.influenciador : undefined,
        empresario:    showEmpresario    ? values.empresario    : undefined,
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
              DADOS DO CONTATO
          ══════════════════════════════════════ */}
          <SectionHeader title="Dados do Contato" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome completo">
              <Input
                value={values.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Nome do contato"
                data-testid="input-nome"
              />
            </Field>
            <Field label="Empresa / Contratante">
              <Input
                value={values.empresa}
                onChange={(e) => set("empresa", e.target.value)}
                placeholder="Nome da empresa"
                data-testid="input-empresa"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cargo / Função">
              <Input
                value={values.cargo}
                onChange={(e) => set("cargo", e.target.value)}
                placeholder="Ex: produtor, promoter..."
                data-testid="input-cargo"
              />
            </Field>
            <Field label="Email">
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
                value={values.telefone}
                onChange={(e) => set("telefone", maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                data-testid="input-telefone"
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
            <Field label="Website">
              <Input
                value={values.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://..."
                data-testid="input-website"
              />
            </Field>
            <Field label="Endereço">
              <Input
                value={values.endereco}
                onChange={(e) => set("endereco", e.target.value)}
                placeholder="Rua, número..."
                data-testid="input-endereco"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cidade">
              <Input
                value={values.cidade}
                onChange={(e) => set("cidade", e.target.value)}
                placeholder="Ex: São Paulo"
                data-testid="input-cidade"
              />
            </Field>
            <Field label="Estado (UF)">
              <SelectField
                value={values.estado}
                onChange={(v) => set("estado", v)}
                options={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))}
                placeholder="UF"
                testId="select-estado"
              />
            </Field>
          </div>

          {/* ══════════════════════════════════════
              CLASSIFICAÇÃO DO LEAD
          ══════════════════════════════════════ */}
          <SectionHeader title="Classificação do Lead" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de Lead">
              <SelectField
                value={values.tipo_lead}
                onChange={(v) => {
                  const novoTipo = v as TipoLead;
                  const servicosValidos = getServicosForTipoLead(novoTipo).map((o) => o.value);
                  setValues((prev) => ({
                    ...prev,
                    tipo_lead:            novoTipo,
                    servico:              servicosValidos.includes(prev.servico) ? prev.servico : "",
                    nome_artista_servico: "",
                  }));
                }}
                options={TIPO_LEAD_OPTIONS}
                testId="select-type-lead"
              />
            </Field>
            <Field label="Serviço">
              {values.tipo_lead === "outros" ? (
                <Textarea
                  value={values.servico}
                  onChange={(e) => set("servico", e.target.value)}
                  placeholder="Descreva os serviços (um por linha)"
                  className="min-h-[80px]"
                  data-testid="textarea-servico-outros"
                />
              ) : (
                <SelectField
                  value={values.servico}
                  onChange={(v) => set("servico", v)}
                  options={servicosDisponiveis}
                  placeholder={
                    values.tipo_lead
                      ? "Selecione o serviço"
                      : "Selecione antes o tipo de lead"
                  }
                  testId="select-servico"
                />
              )}
            </Field>
          </div>

          {showCampoArtista && (
            <Field label={labelArtista}>
              <Input
                value={values.nome_artista_servico}
                onChange={(e) => set("nome_artista_servico", e.target.value)}
                placeholder={placeholderArtista}
                data-testid="input-nome-artista-servico"
              />
            </Field>
          )}

          <Field label="Descrição da Demanda">
            <Textarea
              value={values.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Descreva a demanda do lead"
              data-testid="textarea-descricao"
            />
          </Field>

          {/* ══════════════════════════════════════
              ORIGEM E GESTÃO COMERCIAL
          ══════════════════════════════════════ */}
          <SectionHeader title="Origem e Gestão Comercial" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Origem do Lead">
              <SelectField
                value={values.origem_lead}
                onChange={(v) => set("origem_lead", v)}
                options={ORIGEM_LEAD_OPTIONS}
                testId="select-origem-lead"
              />
            </Field>
            <Field label="Campanha de Marketing">
              <Input
                value={values.campanha_marketing}
                onChange={(e) => set("campanha_marketing", e.target.value)}
                placeholder="Nome da campanha"
                data-testid="input-campanha-marketing"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de Entrada">
              <DatePickerField
                value={values.data_entrada}
                onChange={(v) => set("data_entrada", v)}
                placeholder="Selecione a data"
                data-testid="datepicker-data-entrada"
              />
            </Field>
            <Field label="Responsável pelo Lead">
              <Input
                value={values.responsavel}
                onChange={(e) => set("responsavel", e.target.value)}
                placeholder="Nome do responsável"
                data-testid="input-responsavel"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status do Lead">
              <SelectField
                value={values.status_lead}
                onChange={(v) => set("status_lead", v)}
                options={leadStatusOptions}
                testId="select-status-lead"
              />
            </Field>
            <Field label="Prioridade">
              <SelectField
                value={values.prioridade}
                onChange={(v) => set("prioridade", v)}
                options={PRIORIDADE_OPTIONS}
                testId="select-prioridade"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Próximo Follow-up">
              <DatePickerField
                value={values.proximo_follow_up}
                onChange={(v) => set("proximo_follow_up", v)}
                placeholder="Selecione a data"
                data-testid="datepicker-proximo-follow-up"
              />
            </Field>
            <Field label="Valor Estimado (R$)">
              <Input
                type="number"
                value={values.valor_estimado}
                onChange={(e) => set("valor_estimado", e.target.value)}
                placeholder="0,00"
                data-testid="input-valor-estimado"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Temperatura">
              <SelectField
                value={values.temperatura}
                onChange={(v) => set("temperatura", v)}
                options={TEMPERATURA_OPTIONS}
                testId="select-temperatura"
              />
            </Field>
          </div>

          {/* ══════════════════════════════════════
              DETALHES DO EVENTO
          ══════════════════════════════════════ */}
          {showEvento && (
            <>
              <SectionHeader title="Detalhes do Evento" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome do Evento">
                  <Input
                    value={values.evento!.nome_evento}
                    onChange={(e) => setEvento("nome_evento", e.target.value)}
                    data-testid="input-evento-nome"
                  />
                </Field>
                <Field label="Tipo de Evento">
                  <SelectField
                    value={values.evento!.tipo_evento}
                    onChange={(v) => setEvento("tipo_evento", v)}
                    options={TIPO_EVENTO_OPTIONS}
                    testId="select-evento-type"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Data do Evento">
                  <DatePickerField
                    value={values.evento!.data_evento}
                    onChange={(v) => setEvento("data_evento", v)}
                    placeholder="Selecione a data"
                    data-testid="datepicker-evento-data"
                  />
                </Field>
                <Field label="Local do Evento">
                  <Input
                    value={values.evento!.local_evento}
                    onChange={(e) => setEvento("local_evento", e.target.value)}
                    data-testid="input-evento-local"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Cidade">
                  <Input
                    value={values.evento!.cidade}
                    onChange={(e) => setEvento("cidade", e.target.value)}
                    data-testid="input-evento-cidade"
                  />
                </Field>
                <Field label="Estado (UF)">
                  <SelectField
                    value={values.evento!.estado}
                    onChange={(v) => setEvento("estado", v)}
                    options={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))}
                    placeholder="UF"
                    testId="select-evento-estado"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Capacidade de Público">
                  <Input
                    value={values.evento!.capacidade_publico}
                    onChange={(e) => setEvento("capacidade_publico", e.target.value)}
                    placeholder="Ex: 5000"
                    data-testid="input-evento-capacidade"
                  />
                </Field>
                {showArtistaBandaEvento && (
                  <Field label="Nome do Artista / Banda">
                    <Input
                      value={values.evento!.nome_artista_banda}
                      onChange={(e) => setEvento("nome_artista_banda", e.target.value)}
                      data-testid="input-evento-artista"
                    />
                  </Field>
                )}
              </div>

              <Field label="Necessidades Adicionais">
                <Textarea
                  value={values.evento!.necessidades_adicionais}
                  onChange={(e) => setEvento("necessidades_adicionais", e.target.value)}
                  placeholder="Descreva as necessidades adicionais do evento..."
                  data-testid="textarea-evento-necessidades"
                />
              </Field>
            </>
          )}

          {/* ══════════════════════════════════════
              DETALHES DA CAMPANHA
          ══════════════════════════════════════ */}
          {showCampanha && (
            <>
              <SectionHeader title="Detalhes da Campanha" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome da Campanha">
                  <Input
                    value={values.campanha!.nome_campanha}
                    onChange={(e) => setCampanha("nome_campanha", e.target.value)}
                    data-testid="input-campanha-nome"
                  />
                </Field>
                <Field label="Tipo da Campanha">
                  <Input
                    value={values.campanha!.tipo_campanha}
                    onChange={(e) => setCampanha("tipo_campanha", e.target.value)}
                    data-testid="input-campanha-type"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Data de Início">
                  <DatePickerField
                    value={values.campanha!.start_date}
                    onChange={(v) => setCampanha("start_date", v)}
                    placeholder="Selecione a data"
                    data-testid="datepicker-campanha-inicio"
                  />
                </Field>
                <Field label="Data de Fim">
                  <DatePickerField
                    value={values.campanha!.end_date}
                    onChange={(v) => setCampanha("end_date", v)}
                    placeholder="Selecione a data"
                    data-testid="datepicker-campanha-fim"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Cidade">
                  <Input
                    value={values.campanha!.cidade}
                    onChange={(e) => setCampanha("cidade", e.target.value)}
                    data-testid="input-campanha-cidade"
                  />
                </Field>
                <Field label="Estado (UF)">
                  <SelectField
                    value={values.campanha!.estado}
                    onChange={(v) => setCampanha("estado", v)}
                    options={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))}
                    placeholder="UF"
                    testId="select-campanha-estado"
                  />
                </Field>
              </div>

              <Field label="Nome do Artista / Banda">
                <Input
                  value={values.campanha!.nome_artista_banda}
                  onChange={(e) => setCampanha("nome_artista_banda", e.target.value)}
                  data-testid="input-campanha-artista"
                />
              </Field>

              <Field label="Necessidades Adicionais">
                <Textarea
                  value={values.campanha!.necessidades_adicionais}
                  onChange={(e) => setCampanha("necessidades_adicionais", e.target.value)}
                  placeholder="Descreva as necessidades adicionais da campanha..."
                  data-testid="textarea-campanha-necessidades"
                />
              </Field>
            </>
          )}

          {/* ══════════════════════════════════════
              DETALHES DO INFLUENCIADOR
          ══════════════════════════════════════ */}
          {showInfluenciador && (
            <>
              <SectionHeader title="Detalhes do Influenciador" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome da Campanha">
                  <Input
                    value={values.influenciador!.nome_campanha}
                    onChange={(e) => setInfluenciador("nome_campanha", e.target.value)}
                    data-testid="input-influ-campanha"
                  />
                </Field>
                <Field label="Tipo da Campanha">
                  <Input
                    value={values.influenciador!.tipo_campanha}
                    onChange={(e) => setInfluenciador("tipo_campanha", e.target.value)}
                    data-testid="input-influ-type"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Local da Campanha">
                  <Input
                    value={values.influenciador!.local_campanha}
                    onChange={(e) => setInfluenciador("local_campanha", e.target.value)}
                    data-testid="input-influ-local"
                  />
                </Field>
                <Field label="Data">
                  <DatePickerField
                    value={values.influenciador!.data}
                    onChange={(v) => setInfluenciador("data", v)}
                    placeholder="Selecione a data"
                    data-testid="datepicker-influ-data"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Cidade">
                  <Input
                    value={values.influenciador!.cidade}
                    onChange={(e) => setInfluenciador("cidade", e.target.value)}
                    data-testid="input-influ-cidade"
                  />
                </Field>
                <Field label="Estado (UF)">
                  <SelectField
                    value={values.influenciador!.estado}
                    onChange={(v) => setInfluenciador("estado", v)}
                    options={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))}
                    placeholder="UF"
                    testId="select-influ-estado"
                  />
                </Field>
              </div>

              <Field label="Necessidades Adicionais">
                <Textarea
                  value={values.influenciador!.necessidades_adicionais}
                  onChange={(e) =>
                    setInfluenciador("necessidades_adicionais", e.target.value)
                  }
                  placeholder="Descreva as necessidades adicionais..."
                  data-testid="textarea-influ-necessidades"
                />
              </Field>
            </>
          )}

          {/* ══════════════════════════════════════
              DETALHES DO EMPRESÁRIO ARTÍSTICO
          ══════════════════════════════════════ */}
          {showEmpresario && (
            <>
              <SectionHeader title="Detalhes do Empresário Artístico" />

              <Field label="Nome do Artista / Banda">
                <Input
                  value={values.empresario!.nome_artista_banda}
                  onChange={(e) => setEmpresario("nome_artista_banda", e.target.value)}
                  data-testid="input-empresario-artista"
                />
              </Field>

              <Field label="Necessidades Adicionais">
                <Textarea
                  value={values.empresario!.necessidades_adicionais}
                  onChange={(e) => setEmpresario("necessidades_adicionais", e.target.value)}
                  placeholder="Descreva as necessidades adicionais..."
                  data-testid="textarea-empresario-necessidades"
                />
              </Field>
            </>
          )}

          {/* ══════════════════════════════════════
              HISTÓRICO DE INTERAÇÕES
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
              onClick={addInteracao}
              data-testid="button-add-interacao"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar interação
            </Button>
          </div>

          {values.interacoes.length === 0 && (
            <p
              className="text-sm text-muted-foreground italic"
              data-testid="interacoes-empty"
            >
              Nenhuma interação registrada.
            </p>
          )}

          {values.interacoes.map((it, idx) => (
            <div
              key={it.id}
              className="rounded-md border bg-muted/20 p-4 space-y-3"
              data-testid={`interacao-card-${it.id}`}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Interação {idx + 1}
                </p>
                <button
                  type="button"
                  onClick={() => removeInteracao(it.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover interação"
                  data-testid={`button-remove-interacao-${it.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Tipo">
                  <SelectField
                    value={it.type}
                    onChange={(v) => updateInteracao(it.id, "type", v)}
                    options={TIPO_INTERACAO_OPTIONS}
                    testId={`select-interacao-type-${it.id}`}
                  />
                </Field>
                <Field label="Data">
                  <DatePickerField
                    value={it.data}
                    onChange={(v) => updateInteracao(it.id, "data", v)}
                    placeholder="Selecione a data"
                    data-testid={`datepicker-interacao-${it.id}`}
                  />
                </Field>
                <Field label="Horário">
                  <Input
                    type="time"
                    value={it.horario}
                    onChange={(e) => updateInteracao(it.id, "horario", e.target.value)}
                    data-testid={`input-interacao-horario-${it.id}`}
                  />
                </Field>
              </div>

              <Field label="Descrição">
                <Textarea
                  value={it.descricao}
                  onChange={(e) => updateInteracao(it.id, "descricao", e.target.value)}
                  placeholder="Descreva a interação..."
                  className="min-h-[80px]"
                  data-testid={`textarea-interacao-${it.id}`}
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
