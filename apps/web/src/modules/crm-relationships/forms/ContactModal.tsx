// ============================================================================
// ContatoFormModal — create/edit a Contact (individual or legal entity).
// ----------------------------------------------------------------------------
// IMPORTANT: some fields below (foto, interacoes, funcao/cargo_responsavel,
// cep/logradouro/numero/complemento/bairro, status_contato, prioridade,
// responsavel_*) do NOT exist as dedicated columns in the current `contatos` table.
// They are persisted via the Contact's `payloadOperacional jsonb` (structural
// compat). Turning them into their own columns requires a schema evolution in the
// backend.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Trash2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { fetchAddressByCEP, maskCEP, maskCNPJ, maskCPF, maskPhone } from "@/shared/lib/masks";
import { contactPriorityOptions, contactStatusOptions, contactTypeOptions } from "../constants";
import { ESTADOS_BR } from "../shared/estados";
import { TIPO_INTERACAO_OPTIONS, type Interacao } from "../shared/interacoes";


// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------

export type TipoPessoa = "pessoa_fisica" | "pessoa_juridica";

export type ContatoFormState = {
  tipo_pessoa: TipoPessoa;

  // Individual (natural person)
  nome_pf: string;
  cpf: string;
  funcao: string;
  foto: string; // data URL ou URL externa

  // Legal entity (company)
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;

  // Comum
  categoria: string;
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
  interacoes: Interacao[];

  // Notes
  observacoes: string;
};

/**
 * Final payload emitted by the modal.
 * Carries ALL form fields + legacy aliases (`nome`, `cpf_cnpj`,
 * `endereco`, `responsavel`, `status`) for compatibility with old
 * consumers (`addCliente.mutate`, etc.).
 */
export type ContatoFormPayload = ContatoFormState & {
  // Aliases legados
  nome: string;
  cpf_cnpj: string;
  endereco: string;
  endereco_completo: string;
  responsavel: string;
  status: string;
  prioridade: string;
};

interface ContatoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValue?: Partial<ContatoFormPayload> | null;
  onSubmit?: (payload: ContatoFormPayload) => void | Promise<void>;
}

// ----------------------------------------------------------------------------
// Defaults & helpers
// ----------------------------------------------------------------------------

const todayISO = () => new Date().toISOString().split("T")[0];
const nowHorario = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const DEFAULTS: ContatoFormState = {
  tipo_pessoa: "pessoa_fisica",
  nome_pf: "",
  cpf: "",
  funcao: "",
  foto: "",
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  categoria: "OTHER",
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
  observacoes: "",
};

const buildDefaults = (initial?: Partial<ContatoFormPayload> | null): ContatoFormState => {
  if (!initial) return { ...DEFAULTS };
  return {
    ...DEFAULTS,
    ...Object.fromEntries(
      Object.entries(initial).filter(([key]) => key in DEFAULTS),
    ),
  } as ContatoFormState;
};

const buildEndereco = (s: ContatoFormState) => {
  const linha1 = [s.logradouro, s.numero].filter(Boolean).join(", ");
  const linha2 = [linha1, s.complemento].filter(Boolean).join(" - ");
  return [linha2, s.bairro].filter(Boolean).join(" / ");
};

const buildEnderecoCompleto = (s: ContatoFormState) => {
  const base = buildEndereco(s);
  const cidadeEstado = [s.cidade, s.estado].filter(Boolean).join(" - ");
  const cep = s.cep ? `CEP ${s.cep}` : "";
  return [base, cidadeEstado, cep].filter(Boolean).join(" · ");
};

const deriveNome = (s: ContatoFormState) =>
  s.tipo_pessoa === "pessoa_fisica" ? s.nome_pf : (s.nome_fantasia || s.razao_social);

const deriveCpfCnpj = (s: ContatoFormState) =>
  s.tipo_pessoa === "pessoa_fisica" ? s.cpf : s.cnpj;

const buildPayload = (s: ContatoFormState): ContatoFormPayload => ({
  ...s,
  nome: deriveNome(s),
  cpf_cnpj: deriveCpfCnpj(s),
  endereco: buildEndereco(s),
  endereco_completo: buildEnderecoCompleto(s),
  responsavel: s.responsavel_nome,
  status: s.status_contato,
  prioridade: s.prioridade_contato,
});

// ----------------------------------------------------------------------------
// Subcomponentes UI internos
// ----------------------------------------------------------------------------

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <p className="text-sm font-semibold tracking-wider text-muted-foreground border-b pb-1 pt-2">
      {number}. {title}
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
// Componente principal
// ----------------------------------------------------------------------------

export function ContatoFormModal({ open, onOpenChange, mode, initialValue, onSubmit }: ContatoFormModalProps) {
  const [state, setState] = useState<ContatoFormState>(() => buildDefaults(initialValue));
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  // Serializes initialValue into a stable string — ensures the form
  // repopulates even when editing different contacts with the modal already open.
  const initialKey = open ? JSON.stringify(initialValue) : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setState(buildDefaults(initialValue)); }, [open, initialKey]);

  const set = <K extends keyof ContatoFormState>(field: K, value: ContatoFormState[K]) =>
    setState((prev) => ({ ...prev, [field]: value }));

  const isPF = state.tipo_pessoa === "pessoa_fisica";
  const isPJ = state.tipo_pessoa === "pessoa_juridica";

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

  // Foto: file → data URL
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
  const addInteracao = () => {
    const nova: Interacao = { id: newId(), type: "whatsapp", data: todayISO(), horario: nowHorario(), descricao: "" };
    setState((prev) => ({ ...prev, interacoes: [...prev.interacoes, nova] }));
  };
  const updateInteracao = <K extends keyof Interacao>(id: string, field: K, value: Interacao[K]) => {
    setState((prev) => ({
      ...prev,
      interacoes: prev.interacoes.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    }));
  };
  const removeInteracao = (id: string) => {
    setState((prev) => ({ ...prev, interacoes: prev.interacoes.filter((i) => i.id !== id) }));
  };

  // Minimal validation — the derived name must exist
  const isValid = useMemo(() => Boolean(deriveNome(state).trim()), [state]);

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
    } finally {
      setSubmitting(false);
    }
  };

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
          {/* 1. TIPO DE CONTATO ============================================ */}
          <SectionHeader number={1} title="Tipo de Contato" />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => set("tipo_pessoa", "pessoa_fisica")}
              className={
                "rounded-md border p-3 text-left transition-colors " +
                (isPF ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/40")
              }
              data-testid="type-pessoa-fisica"
            >
              <p className="text-sm font-medium">Pessoa Física</p>
              <p className="text-xs text-muted-foreground">CPF, função, foto</p>
            </button>
            <button
              type="button"
              onClick={() => set("tipo_pessoa", "pessoa_juridica")}
              className={
                "rounded-md border p-3 text-left transition-colors " +
                (isPJ ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/40")
              }
              data-testid="type-pessoa-juridica"
            >
              <p className="text-sm font-medium">Pessoa Jurídica</p>
              <p className="text-xs text-muted-foreground">CNPJ, razão social, cargo</p>
            </button>
          </div>

          {/* 2. DADOS DO CONTATO ========================================== */}
          <SectionHeader number={2} title={isPF ? "Dados da Pessoa Física" : "Dados da Pessoa Jurídica"} />

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

              <Field label="Função">
                <Input
                  value={state.funcao}
                  onChange={(e) => set("funcao", e.target.value)}
                  placeholder="Ex: produtor, técnico, fotógrafo"
                  data-testid="input-pf-funcao"
                />
              </Field>
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
              </div>
            </>
          )}

          {/* 3. CONTATO ===================================================== */}
          <SectionHeader number={3} title="Contato" />

          <div className="grid grid-cols-3 gap-4">
            <Field label="Categoria / Segmento">
              <Select value={state.categoria} onValueChange={(v) => set("categoria", v)}>
                <SelectTrigger data-testid="select-categoria">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contactTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Field label="Telefone">
              <Input
                value={state.telefone}
                onChange={(e) => set("telefone", maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                data-testid="input-telefone"
              />
            </Field>
          </div>

          {/* 4. ADDRESS ===================================================== */}
          <SectionHeader number={4} title="Endereço" />

          <div className="grid grid-cols-3 gap-4">
            <Field label="CEP">
              <Input
                value={state.cep}
                onChange={(e) => set("cep", maskCEP(e.target.value))}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                data-testid="input-cep"
              />
              {cepLoading && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
            </Field>
            <Field label="Logradouro">
              <Input
                value={state.logradouro}
                onChange={(e) => set("logradouro", e.target.value)}
                placeholder="Rua, avenida..."
                data-testid="input-logradouro"
              />
            </Field>
            <Field label="Número">
              <Input
                value={state.numero}
                onChange={(e) => set("numero", e.target.value)}
                placeholder="Ex: 123"
                data-testid="input-numero"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Complemento">
              <Input
                value={state.complemento}
                onChange={(e) => set("complemento", e.target.value)}
                placeholder="Apto, sala, bloco..."
                data-testid="input-complemento"
              />
            </Field>
            <Field label="Bairro">
              <Input
                value={state.bairro}
                onChange={(e) => set("bairro", e.target.value)}
                placeholder="Bairro"
                data-testid="input-bairro"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cidade">
              <Input
                value={state.cidade}
                onChange={(e) => set("cidade", e.target.value)}
                placeholder="Cidade"
                data-testid="input-cidade"
              />
            </Field>
            <Field label="Estado">
              <Select value={state.estado} onValueChange={(v) => set("estado", v)}>
                <SelectTrigger data-testid="select-estado">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_BR.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* 5. CLASSIFICATION ============================================== */}
          <SectionHeader number={5} title="Classificação" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status do Contato">
              <Select value={state.status_contato} onValueChange={(v) => set("status_contato", v)}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contactStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={state.prioridade_contato} onValueChange={(v) => set("prioridade_contato", v)}>
                <SelectTrigger data-testid="select-prioridade">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contactPriorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* 6. RESPONSIBLE PERSON ========================================== */}
          <SectionHeader number={6} title="Responsável" />

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

          {/* 7. INTERACTION HISTORY ========================================= */}
          <div className="flex items-center justify-between border-b pb-1 pt-2">
            <p className="text-sm font-semibold tracking-wider text-muted-foreground">
              7. Histórico de Interações
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addInteracao} data-testid="button-add-interacao">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar interação
            </Button>
          </div>

          {state.interacoes.length === 0 && (
            <p className="text-sm italic text-muted-foreground" data-testid="interacoes-empty">
              Nenhuma interação registrada.
            </p>
          )}

          {state.interacoes.map((it, idx) => (
            <div key={it.id} className="rounded-md border bg-muted/20 p-4 space-y-3" data-testid={`interacao-card-${it.id}`}>
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
                  <Select value={it.type} onValueChange={(v) => updateInteracao(it.id, "type", v)}>
                    <SelectTrigger data-testid={`select-interacao-type-${it.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_INTERACAO_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          {/* 8. NOTES ======================================================== */}
          <SectionHeader number={8} title="Observações" />

          <Field label="Notas">
            <Textarea
              value={state.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Anotações sobre o contato, contexto operacional, histórico relevante..."
              className="min-h-[100px]"
              data-testid="textarea-observacoes"
            />
          </Field>
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