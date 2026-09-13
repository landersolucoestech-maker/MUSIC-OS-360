import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { toast } from "sonner";
import {
  ChevronRight, ChevronLeft, Check, FileText, Users, Variable,
  Eye, PenLine, ClipboardList, UserPlus, Trash2,
  Building2, User, Music,
} from "lucide-react";
import { useContractTemplates } from "@/modules/contracts/hooks/useContractTemplates";
import { useCategoryRegistry } from "@/modules/contracts/hooks/useCategoryRegistry";
import { useContracts } from "@/modules/contracts/hooks/useContracts";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import type { ContractTemplateRow, ContractVariable, WizardSignerRecord } from "@/modules/contracts/types/contracts.types";
import type { ContractWithRelations, ContractInsert } from "@/modules/contracts/hooks/useContracts";
import type { SigningPlatform } from "@/modules/contracts/types/contracts.types";
import { cn } from "@/shared/lib/utils";
import { A4Preview } from "@/modules/contracts/components/ContractA4Preview";

// ── Types ──────────────────────────────────────────────────────────────────

type PartyTipo = "pf" | "pj" | "artista";
type PartyOrigin = "manual" | "crm" | "artistas";

interface PartyData {
  type: PartyTipo;
  origin: PartyOrigin;
  sourceId?: string;
  nome?: string;
  nome_artistico?: string;
  nome_civil?: string;
  cpf?: string;
  cnpj?: string;
  rg?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  nacionalidade?: string;
  profissao?: string;
  estado_civil?: string;
  razao_social?: string;
  representante_legal?: string;
  cpf_representante?: string;
  rg_representante?: string;
  nacionalidade_representante?: string;
  estado_civil_representante?: string;
  profissao_representante?: string;
  endereco_representante?: string;
}

interface WizardSigner {
  id: string;
  role: string;
  nome: string;
  email: string;
  obrigatorio: boolean;
  ordem: number;
  provider: SigningPlatform | "";
}

interface WizardMeta {
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  observations: string;
}

/** Parsed variables_manifest entry (subset of ContractVariable) */
interface ManifestVar {
  key: string;       // "CONTRACT.DURATION_MONTHS"
  label: string;
  type: ContractVariable["type"];
  required: boolean;
  example: string;
  options?: string[];
}

interface WizardState {
  templateId: string;
  templateNome: string;
  /** Canonical category slug (tipo_servico), e.g. "gravacao" — used as contract type */
  templateTipoServico: string;
  templateContent: string;
  partyRoles: string[];
  /** Union of roles from SIGNATURE.* INITIALS.* SIGN_DATE.* */
  signatureRoles: string[];
  /** Variables from manifest (type-aware); fallback: regex-detected non-party placeholders */
  manifestVars: ManifestVar[];
  parties: Record<string, PartyData>;
  variables: Record<string, string>;
  signers: WizardSigner[];
  meta: WizardMeta;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SIGNATURE_GROUPS = new Set(["SIGNATURE", "INITIALS", "SIGN_DATE"]);
const NON_PARTY_GROUPS = new Set([
  "SIGNATURE", "INITIALS", "SIGN_DATE",
  "CONTRACT", "FINANCIAL", "VIGENCIA", "OBRA", "OBRA_MUSICAL",
  "SYSTEM", "DATA", "PRAZO", "PENALTY",
]);
const ENTITY_FIELDS = new Set([
  "NAME", "NOME", "CPF", "CNPJ", "RG", "EMAIL", "ADDRESS", "ENDERECO",
  "TELEFONE", "CELULAR", "NACIONALIDADE", "PROFISSAO", "ESTADO_CIVIL",
  "RAZAO_SOCIAL", "REPRESENTANTE_LEGAL", "CPF_REPRESENTANTE", "RG_REPRESENTANTE",
  "NOME_ARTISTICO", "NOME_CIVIL",
  // English-style aliases used by templates created in the template editor
  "LEGAL_REPRESENTATIVE", "REPRESENTATIVE_NAME",
  "LEGAL_REPRESENTATIVE_CPF", "LEGAL_REPRESENTATIVE_RG",
  "LEGAL_REPRESENTATIVE_NATIONALITY", "LEGAL_REPRESENTATIVE_MARITAL_STATUS",
  "LEGAL_REPRESENTATIVE_OCCUPATION", "LEGAL_REPRESENTATIVE_ADDRESS",
]);

const WIZARD_STEPS = [
  { label: "Template",    icon: FileText },
  { label: "Partes",      icon: Users },
  { label: "Variáveis",  icon: Variable },
  { label: "Documento",   icon: Eye },
  { label: "Signatários", icon: PenLine },
  { label: "Revisão",     icon: ClipboardList },
];

const STATUS_LABELS: Record<string, string> = {
  draft:                 "Rascunho",
  pendente:              "Pendente",
  awaiting_signature:    "Aguardando Assinatura",
  signed:                "Assinado",
  active:                "Ativo",
  in_force:              "Vigente",
  expirado:              "Expirado",
  rescindido:            "Rescindido",
  cancelled:             "Cancelado",
};

const EMPTY_PARTY: PartyData = { type: "pf", origin: "manual" };

const EMPTY_META: WizardMeta = {
  title: "", status: "draft", start_date: "", end_date: "", observations: "",
};

const EMPTY_WIZARD: WizardState = {
  templateId: "", templateNome: "", templateTipoServico: "", templateContent: "",
  partyRoles: [], signatureRoles: [], manifestVars: [],
  parties: {}, variables: {}, signers: [], meta: EMPTY_META,
};

// ── Helpers ────────────────────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{\{([A-Z][A-Z0-9_]*)\.([A-Z0-9_]+)\}\}/g;

function extractGroups(content: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [, group, field] of content.matchAll(PLACEHOLDER_RE)) {
    if (!map.has(group)) map.set(group, new Set());
    map.get(group)!.add(field);
  }
  return map;
}

function extractPartyRoles(content: string): string[] {
  const groups = extractGroups(content);
  return [...groups.entries()]
    .filter(([group, fields]) =>
      !NON_PARTY_GROUPS.has(group) &&
      [...fields].some((f) => ENTITY_FIELDS.has(f)),
    )
    .map(([group]) => group);
}

/**
 * FIX: extract from SIGNATURE, INITIALS, and SIGN_DATE — the field part is the role.
 * e.g. {{SIGNATURE.REPRESENTANTE}} → role "REPRESENTANTE"
 *      {{INITIALS.ARTISTA}} → role "ARTISTA"
 *      {{SIGN_DATE.CONTRATANTE}} → role "CONTRATANTE"
 */
function extractSignatureRoles(content: string): string[] {
  const groups = extractGroups(content);
  const roles = new Set<string>();
  for (const group of SIGNATURE_GROUPS) {
    const fields = groups.get(group);
    if (fields) fields.forEach((f) => roles.add(f));
  }
  return [...roles];
}

function extractFallbackVars(content: string, partyRoles: string[]): ManifestVar[] {
  const partySet = new Set(partyRoles);
  const groups = extractGroups(content);
  const out: ManifestVar[] = [];
  for (const [group, fields] of groups.entries()) {
    if (SIGNATURE_GROUPS.has(group)) continue;
    if (partySet.has(group)) continue;
    for (const field of fields) {
      const key = `{{${group}.${field}}}`;
      out.push({
        key,
        label: `${group} — ${field.replace(/_/g, " ")}`,
        type: "text",
        required: false,
        example: "",
      });
    }
  }
  return out;
}

function parseManifest(raw: string | null | undefined, content: string, partyRoles: string[]): ManifestVar[] {
  if (!raw) return extractFallbackVars(content, partyRoles);
  try {
    const json = JSON.parse(raw);
    // Support both raw array format AND object format { variables: [...], generatedAt: ... }
    const entries: ContractVariable[] = Array.isArray(json)
      ? json
      : (Array.isArray(json?.variables) ? json.variables : []);
    if (entries.length === 0) {
      return extractFallbackVars(content, partyRoles);
    }
    return entries.map((v) => ({
      key: `{{${v.key}}}`,
      label: v.label || v.key,
      type: v.type || "text",
      required: !!v.required,
      example: v.example || "",
      options: Array.isArray(v.options) ? v.options : undefined,
    }));
  } catch {
    return extractFallbackVars(content, partyRoles);
  }
}

function resolvePartyField(party: PartyData, field: string): string {
  const f = field.toUpperCase();
  if (f === "NAME" || f === "NOME") {
    if (party.type === "pj") return party.razao_social || "";
    if (party.type === "artista") return party.nome_artistico || party.nome_civil || party.nome || "";
    return party.nome || "";
  }
  const MAP: Record<string, keyof PartyData> = {
    CPF:                 "cpf",
    CNPJ:                "cnpj",
    RG:                  "rg",
    EMAIL:               "email",
    TELEFONE:            "telefone",
    CELULAR:             "telefone",
    ENDERECO:            "endereco",
    ADDRESS:             "endereco",
    NACIONALIDADE:       "nacionalidade",
    PROFISSAO:           "profissao",
    ESTADO_CIVIL:        "estado_civil",
    RAZAO_SOCIAL:        "razao_social",
    // Portuguese-style keys
    REPRESENTANTE_LEGAL: "representante_legal",
    CPF_REPRESENTANTE:   "cpf_representante",
    RG_REPRESENTANTE:    "rg_representante",
    // English-style aliases (used by templates created in the template editor)
    LEGAL_REPRESENTATIVE:             "representante_legal",
    REPRESENTATIVE_NAME:              "representante_legal",
    LEGAL_REPRESENTATIVE_CPF:         "cpf_representante",
    LEGAL_REPRESENTATIVE_RG:          "rg_representante",
    LEGAL_REPRESENTATIVE_NATIONALITY: "nacionalidade_representante",
    LEGAL_REPRESENTATIVE_MARITAL_STATUS: "estado_civil_representante",
    LEGAL_REPRESENTATIVE_OCCUPATION:  "profissao_representante",
    LEGAL_REPRESENTATIVE_ADDRESS:     "endereco_representante",
    NOME_ARTISTICO:      "nome_artistico",
    NOME_CIVIL:          "nome_civil",
  };
  const key = MAP[f];
  return key ? String(party[key] || "") : "";
}

/**
 * Resolves party/variable placeholders in the template content.
 * Resolved values replace the placeholder with plain text.
 * Unresolved placeholders are left as {{GROUP.FIELD}} so that
 * HighlightedPreview (used inside A4Preview) renders them highlighted.
 * Signature placeholders are replaced with a human-readable label.
 */
function resolveContentForPreview(
  content: string,
  parties: Record<string, PartyData>,
  variables: Record<string, string>,
): string {
  return content.replace(PLACEHOLDER_RE, (match, group, field) => {
    if (SIGNATURE_GROUPS.has(group)) {
      return `[Assinatura: ${field}]`;
    }
    const party = parties[group];
    if (party) {
      const val = resolvePartyField(party, field);
      if (val) return val;
    }
    const varKey = `{{${group}.${field}}}`;
    const varVal = variables[varKey];
    if (varVal) return varVal;
    return match; // keep as {{...}} — HighlightedPreview will highlight it
  });
}

// ── Step 1 — Template ──────────────────────────────────────────────────────

function StepTemplate({
  state, onSelect, categories,
}: {
  state: WizardState;
  onSelect: (t: ContractTemplateRow, label: string) => void;
  categories: Array<{ value: string; label: string }>;
}) {
  const { templates } = useContractTemplates();
  const active = templates.filter((t) => t.ativo !== false);

  const getCategoryLabel = useCallback(
    (tipoServico: string) => {
      const found = categories.find((c) => c.value === tipoServico);
      return found ? found.label : tipoServico;
    },
    [categories],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecione o template. O formulário será gerado automaticamente a partir dos placeholders.
      </p>
      {active.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum template activo. Crie um template em <strong>Contratos → Templates</strong>.
        </div>
      ) : (
        <div className="grid gap-3">
          {active.map((t) => {
            const selected = state.templateId === t.id;
            const label = getCategoryLabel(t.tipo_servico);
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`select-template-${t.id}`}
                onClick={() => onSelect(t, label)}
                className={cn(
                  "w-full text-left rounded-lg border p-4 transition-colors",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{t.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    {t.descricao && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.descricao}</p>
                    )}
                  </div>
                  {selected && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Step 2 — Partes ────────────────────────────────────────────────────────

function PartyCard({
  role, party, onChange,
}: {
  role: string;
  party: PartyData;
  onChange: (p: PartyData) => void;
}) {
  const set = useCallback(
    (patch: Partial<PartyData>) => onChange({ ...party, ...patch }),
    [party, onChange],
  );

  const icons: Record<PartyTipo, typeof User> = { pf: User, pj: Building2, artista: Music };
  const Icon = icons[party.type];

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{role}</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={party.type}
            onValueChange={(v) => set({ type: v as PartyTipo, nome: "", cpf: "", cnpj: "", email: "", sourceId: undefined })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pf">Pessoa Física</SelectItem>
              <SelectItem value="pj">Pessoa Jurídica</SelectItem>
              <SelectItem value="artista">Artista</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Origem</Label>
          <Select value={party.origin} onValueChange={(v) => set({ origin: v as PartyOrigin, sourceId: undefined })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="crm">CRM</SelectItem>
              {party.type === "artista" && <SelectItem value="artistas">Artistas</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      {party.origin === "crm" && (
        <div className="space-y-1">
          <Label className="text-xs">Selecionar do CRM</Label>
          <AsyncEntityCombobox<Record<string, unknown> & { id: string }>
            table="clientes"
            value={party.sourceId || null}
            getLabel={(c) => String(c.nome || "")}
            placeholder="Selecionar contato…"
            searchPlaceholder="Buscar por nome…"
            emptyText="Nenhum contato encontrado"
            data-testid="combobox-crm-contato"
            onChange={(id, c) => {
              if (!c) return;
              const isPF = c.tipo_pessoa === "pessoa_fisica";
              const doc = String(c.document || "");
              set({
                sourceId: id,
                nome: String(c.nome || ""),
                cpf: isPF ? doc : "",
                cnpj: !isPF ? doc : "",
                email: String(c.email || ""),
                telefone: String(c.phone || ""),
                endereco: String(c.address || c.endereco_completo || ""),
                razao_social: String(c.razao_social || c.nome || ""),
                representante_legal: String(c.responsavel_nome || ""),
              });
            }}
          />
        </div>
      )}

      {party.origin === "artistas" && (
        <div className="space-y-1">
          <Label className="text-xs">Selecionar Artista</Label>
          <AsyncEntityCombobox<Record<string, unknown> & { id: string }>
            table="artistas"
            value={party.sourceId || null}
            getLabel={(a) => String(a.nome_artistico || a.nome_civil || "")}
            placeholder="Selecionar artista…"
            searchPlaceholder="Buscar por nome…"
            emptyText="Nenhum artista encontrado"
            data-testid="combobox-artista"
            onChange={(id, a) => {
              if (!a) return;
              set({
                sourceId: id,
                nome_artistico: String(a.nome_artistico || ""),
                nome_civil: String(a.nome_civil || ""),
                cpf: String(a.cpf || ""),
                email: String(a.email || ""),
              });
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {party.type === "artista" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Nome Artístico</Label>
              <Input className="h-8 text-xs" value={party.nome_artistico || ""} onChange={(e) => set({ nome_artistico: e.target.value })} placeholder="Nome artístico" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome Civil</Label>
              <Input className="h-8 text-xs" value={party.nome_civil || ""} onChange={(e) => set({ nome_civil: e.target.value })} placeholder="Nome completo" />
            </div>
          </>
        )}

        {party.type === "pf" && (
          <>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label className="text-xs">Nome Completo</Label>
              <Input className="h-8 text-xs" value={party.nome || ""} onChange={(e) => set({ nome: e.target.value })} placeholder="Nome" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nacionalidade</Label>
              <Input className="h-8 text-xs" value={party.nacionalidade || ""} onChange={(e) => set({ nacionalidade: e.target.value })} placeholder="Brasileiro(a)" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Profissão</Label>
              <Input className="h-8 text-xs" value={party.profissao || ""} onChange={(e) => set({ profissao: e.target.value })} placeholder="Profissão" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado Civil</Label>
              <Select value={party.estado_civil || ""} onValueChange={(v) => set({ estado_civil: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                  <SelectItem value="casado">Casado(a)</SelectItem>
                  <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                  <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                  <SelectItem value="uniao_estavel">União Estável</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {party.type === "pj" && (
          <>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Razão Social</Label>
              <Input className="h-8 text-xs" value={party.razao_social || ""} onChange={(e) => set({ razao_social: e.target.value })} placeholder="Razão social" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CNPJ</Label>
              <Input className="h-8 text-xs font-sans" value={party.cnpj || ""} onChange={(e) => set({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Endereço</Label>
              <Input className="h-8 text-xs" value={party.endereco || ""} onChange={(e) => set({ endereco: e.target.value })} placeholder="Rua, número, cidade - UF" />
            </div>
            <div className="space-y-1 col-span-2 border-t border-border pt-2 mt-1">
              <p className="text-[10px] font-medium text-muted-foreground  tracking-wide">Dados do Representante Legal</p>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Nome do Representante Legal</Label>
              <Input className="h-8 text-xs" value={party.representante_legal || ""} onChange={(e) => set({ representante_legal: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nacionalidade (Repr.)</Label>
              <Input className="h-8 text-xs" value={party.nacionalidade_representante || ""} onChange={(e) => set({ nacionalidade_representante: e.target.value })} placeholder="Ex: brasileiro(a)" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Profissão (Repr.)</Label>
              <Input className="h-8 text-xs" value={party.profissao_representante || ""} onChange={(e) => set({ profissao_representante: e.target.value })} placeholder="Profissão" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado Civil (Repr.)</Label>
              <Select value={party.estado_civil_representante || "none"} onValueChange={(v) => set({ estado_civil_representante: v === "none" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                  <SelectItem value="casado">Casado(a)</SelectItem>
                  <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                  <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                  <SelectItem value="uniao_estavel">União Estável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Endereço (Repr.)</Label>
              <Input className="h-8 text-xs" value={party.endereco_representante || ""} onChange={(e) => set({ endereco_representante: e.target.value })} placeholder="Rua, número, cidade - UF" />
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label className="text-xs">CPF {party.type === "pj" ? "(Repr.)" : ""}</Label>
          <Input className="h-8 text-xs font-sans" value={party.cpf || ""} onChange={(e) => set({ cpf: e.target.value })} placeholder="000.000.000-00" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">RG {party.type === "pj" ? "(Repr.)" : ""}</Label>
          <Input className="h-8 text-xs font-sans" value={party.rg || ""} onChange={(e) => set({ rg: e.target.value })} placeholder="RG" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">E-mail</Label>
          <Input className="h-8 text-xs" type="email" value={party.email || ""} onChange={(e) => set({ email: e.target.value })} placeholder="email@exemplo.com" />
        </div>

        {party.type !== "pj" && (
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Endereço</Label>
            <Input className="h-8 text-xs" value={party.endereco || ""} onChange={(e) => set({ endereco: e.target.value })} placeholder="Rua, número, cidade - UF" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3 — Variáveis (manifest-driven) ──────────────────────────────────

function VariableField({
  manifest, value, onChange,
}: {
  manifest: ManifestVar;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputId = `var-${manifest.key.replace(/[{}. ]/g, "_")}`;

  const renderInput = () => {
    switch (manifest.type) {
      case "date":
        return (
          <DatePickerField
            value={value}
            onChange={(v) => onChange(v || "")}
            placeholder={manifest.example || "Selecione uma data"}
            data-testid={inputId}
          />
        );
      case "boolean":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={value === "true"}
              onCheckedChange={(v) => onChange(v ? "true" : "false")}
              data-testid={inputId}
            />
            <span className="text-xs text-muted-foreground">{manifest.example || "Sim/Não"}</span>
          </label>
        );
      case "number":
      case "percentage":
        return (
          <div className="relative">
            <Input
              className="h-8 text-xs font-sans pr-8"
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={manifest.example || "0"}
              data-testid={inputId}
            />
            {manifest.type === "percentage" && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            )}
          </div>
        );
      case "currency":
        return (
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input
              className="h-8 text-xs font-sans pl-8"
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={manifest.example || "0,00"}
              data-testid={inputId}
            />
          </div>
        );
      case "textarea":
        return (
          <Textarea
            className="text-xs min-h-[60px]"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={manifest.example || manifest.key}
            data-testid={inputId}
          />
        );
      case "select":
        return (
          <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs" data-testid={inputId}>
              <SelectValue placeholder="Selecionar…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Selecionar —</SelectItem>
              {(manifest.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <Input
            className="h-8 text-xs"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={manifest.example || manifest.key}
            data-testid={inputId}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{manifest.label}</Label>
        {manifest.required && <span className="text-destructive text-xs">*</span>}
        <span className="text-[10px] text-muted-foreground/60 font-sans">{manifest.key}</span>
      </div>
      {renderInput()}
    </div>
  );
}

// ── Step 5 — Signatários ────────────────────────────────────────────────────

function SignerRow({
  signer, onUpdate, onRemove,
}: {
  signer: WizardSigner;
  onUpdate: (s: WizardSigner) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<WizardSigner>) => onUpdate({ ...signer, ...patch });

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="text-xs">{signer.role}</Badge>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={signer.obrigatorio}
              onCheckedChange={(v) => set({ obrigatorio: Boolean(v) })}
            />
            Obrigatório
          </label>
          <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input className="h-8 text-xs" value={signer.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">E-mail</Label>
          <Input className="h-8 text-xs" type="email" value={signer.email} onChange={(e) => set({ email: e.target.value })} placeholder="email@exemplo.com" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ordem</Label>
          <Input className="h-8 text-xs" type="number" min={1} value={signer.ordem} onChange={(e) => set({ ordem: Number(e.target.value) })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Plataforma</Label>
          <Select
            value={signer.provider || "none"}
            onValueChange={(v) => set({ provider: (v === "none" ? "" : v) as WizardSigner["provider"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem plataforma</SelectItem>
              <SelectItem value="autentique">Autentique</SelectItem>
              <SelectItem value="clicksign">Clicksign</SelectItem>
              <SelectItem value="docusign">DocuSign</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ── Preview Panel ──────────────────────────────────────────────────────────

function PreviewPanel({
  state, headerImage, footerImage,
}: {
  state: WizardState;
  headerImage?: string | null;
  footerImage?: string | null;
}) {
  const resolvedContent = useMemo(
    () => state.templateContent
      ? resolveContentForPreview(state.templateContent, state.parties, state.variables)
      : "",
    [state.templateContent, state.parties, state.variables],
  );

  if (!state.templateId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">Selecione um template para visualizar o documento</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-muted-foreground  tracking-wide">Pré-visualização</span>
        <span className="text-[10px] text-muted-foreground">
          Campos <span className="text-primary font-medium">destacados</span> ainda não preenchidos
        </span>
      </div>
      <ScrollArea className="flex-1">
        <A4Preview
          headerImage={headerImage ?? null}
          content={resolvedContent}
          footerImage={footerImage ?? null}
        />
      </ScrollArea>
    </div>
  );
}

// ── Step 6 — Revisão ────────────────────────────────────────────────────────

function ReviewStep({ state, onMeta }: { state: WizardState; onMeta: (m: WizardMeta) => void }) {
  const m = state.meta;
  const setMeta = (patch: Partial<WizardMeta>) => onMeta({ ...m, ...patch });

  const filledParties = state.partyRoles.filter((r) => {
    const p = state.parties[r];
    if (!p) return false;
    if (p.type === "artista") return !!(p.nome_artistico || p.nome_civil);
    if (p.type === "pj") return !!p.razao_social;
    return !!p.nome;
  }).length;

  const resolvedVars = Object.values(state.variables).filter((v) => v.trim()).length;
  const requiredVarsTotal = state.manifestVars.filter((v) => v.required).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Template</span><span className="font-medium">{state.templateNome || "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Partes preenchidas</span><span className="font-medium">{filledParties}/{state.partyRoles.length}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Variáveis preenchidas</span><span className="font-medium">{resolvedVars}/{state.manifestVars.length}</span></div>
        {requiredVarsTotal > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Variáveis obrigatórias</span><span className="font-medium">{requiredVarsTotal}</span></div>
        )}
        <div className="flex justify-between"><span className="text-muted-foreground">Signatários</span><span className="font-medium">{state.signers.length}</span></div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Título do Contrato *</Label>
          <Input
            data-testid="input-title-revisao"
            value={m.title}
            onChange={(e) => setMeta({ title: e.target.value })}
            placeholder="Ex: Contrato de Empresariamento Artístico"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Data de Início *</Label>
            <DatePickerField
              value={m.start_date}
              onChange={(v) => setMeta({ start_date: v || "" })}
              placeholder="Selecione"
              data-testid="datepicker-wizard-inicio"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data de Término</Label>
            <DatePickerField
              value={m.end_date}
              onChange={(v) => setMeta({ end_date: v || "" })}
              placeholder="Selecione"
              data-testid="datepicker-wizard-fim"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={m.status} onValueChange={(v) => setMeta({ status: v })}>
            <SelectTrigger data-testid="select-wizard-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea
            value={m.observations}
            onChange={(e) => setMeta({ observations: e.target.value })}
            placeholder="Observações internas sobre este contrato…"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main ContractWizard ────────────────────────────────────────────────────

interface ContractWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato?: ContractWithRelations | null;
}

export function ContractWizard({ open, onOpenChange, contrato }: ContractWizardProps) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(EMPTY_WIZARD);
  const [isSaving, setIsSaving] = useState(false);

  const { addContract, updateContract } = useContracts();
  const { categories } = useCategoryRegistry();
  const { templates } = useContractTemplates();

  const isEdit = !!contrato;

  // ── Initialise state on open ─────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    if (contrato) {
      const tmpl = templates.find((t) => t.id === contrato.template_id);

      // FIX: parse saved wizard blob from observacoes to hydrate parties/variables
      let savedBlob: { parties?: Record<string, PartyData>; variables?: Record<string, string> } = {};
      try {
        if (contrato.observacoes && contrato.observacoes.startsWith("{")) {
          savedBlob = JSON.parse(contrato.observacoes);
        }
      } catch { /* ignore parse errors */ }

      const baseMeta: WizardMeta = {
        title:       contrato.title || "",
        status:       String(contrato.status || "draft"),
        start_date:  contrato.start_date || "",
        end_date:     contrato.end_date || "",
        observations: "",
      };

      if (tmpl) {
        const partyRoles   = extractPartyRoles(tmpl.conteudo);
        const signatureRoles = extractSignatureRoles(tmpl.conteudo);
        const manifestVars = parseManifest(tmpl.variables_manifest, tmpl.conteudo, partyRoles);

        // Seed party entries; prefer saved data over empty shells
        const initialParties: Record<string, PartyData> = {};
        for (const role of partyRoles) {
          initialParties[role] = (savedBlob.parties?.[role] as PartyData | undefined) ?? { type: "pf", origin: "manual" };
        }

        const savedSigners: WizardSigner[] = Array.isArray(contrato.signers)
          ? (contrato.signers as unknown[]).map((s, i) => {
              const r = s as Record<string, unknown>;
              return {
                id:          String(i),
                role:        String(r.role ?? "OUTRO"),
                nome:        String(r.nome ?? r.name ?? ""),
                email:       String(r.email ?? ""),
                obrigatorio: Boolean(r.obrigatorio ?? true),
                ordem:       Number(r.ordem ?? i + 1),
                provider:    (r.provider as SigningPlatform) || "" as const,
              };
            })
          : signatureRoles.map((role, i) => ({
              id: `sig-${Date.now()}-${i}`,
              role,
              nome: "",
              email: "",
              obrigatorio: true,
              ordem: i + 1,
              provider: "",
            }));

        setState({
          templateId:          tmpl.id,
          templateNome:        tmpl.nome,
          templateTipoServico: tmpl.tipo_servico || "",
          templateContent:     tmpl.conteudo,
          partyRoles,
          signatureRoles,
          manifestVars,
          parties:   initialParties,
          variables: savedBlob.variables ?? {},
          signers:   savedSigners,
          meta:      baseMeta,
        });
      } else {
        setState({ ...EMPTY_WIZARD, meta: baseMeta });
      }
    } else {
      setState(EMPTY_WIZARD);
    }

    setStep(1);
  }, [open, contrato, templates]);

  // ── Template selection ───────────────────────────────────────────────────

  const handleSelectTemplate = useCallback((t: ContractTemplateRow) => {
    const partyRoles     = extractPartyRoles(t.conteudo);
    const signatureRoles = extractSignatureRoles(t.conteudo);
    const manifestVars   = parseManifest(t.variables_manifest, t.conteudo, partyRoles);

    const initialParties: Record<string, PartyData> = {};
    for (const role of partyRoles) {
      initialParties[role] = { type: "pf", origin: "manual" };
    }

    const initialSigners: WizardSigner[] = signatureRoles.map((role, i) => ({
      id: `sig-${Date.now()}-${i}`,
      role,
      nome:        "",
      email:       "",
      obrigatorio: true,
      ordem:       i + 1,
      provider:    "",
    }));

    setState((prev) => ({
      ...prev,
      templateId:          t.id,
      templateNome:        t.nome,
      templateTipoServico: t.tipo_servico || "",
      templateContent:     t.conteudo,
      partyRoles,
      signatureRoles,
      manifestVars,
      parties:   initialParties,
      variables: {},
      signers:   initialSigners,
    }));
  }, []);

  // ── Updaters ─────────────────────────────────────────────────────────────

  const updateParty    = useCallback((role: string, party: PartyData) =>
    setState((p) => ({ ...p, parties: { ...p.parties, [role]: party } })), []);

  const updateVariable = useCallback((key: string, value: string) =>
    setState((p) => ({ ...p, variables: { ...p.variables, [key]: value } })), []);

  const updateSigner   = useCallback((id: string, signer: WizardSigner) =>
    setState((p) => ({ ...p, signers: p.signers.map((s) => s.id === id ? signer : s) })), []);

  const removeSigner   = useCallback((id: string) =>
    setState((p) => ({ ...p, signers: p.signers.filter((s) => s.id !== id) })), []);

  const addSigner      = useCallback(() => {
    const id = `sig-${Date.now()}`;
    setState((p) => ({
      ...p,
      signers: [...p.signers, { id, role: "OUTRO", nome: "", email: "", obrigatorio: false, ordem: p.signers.length + 1, provider: "" }],
    }));
  }, []);

  const updateMeta     = useCallback((meta: WizardMeta) =>
    setState((p) => ({ ...p, meta })), []);

  // ── Advance guard ────────────────────────────────────────────────────────

  const canAdvance = useMemo(() => {
    if (step === 1) return !!state.templateId;
    if (step === 6) return !!state.meta.title.trim() && !!state.meta.start_date;
    return true;
  }, [step, state]);

  const selectedTemplate = templates.find((t) => t.id === state.templateId);

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave(sendForSignature: boolean) {
    if (!state.meta.title.trim()) { toast.error("Preencha o título do contrato"); return; }
    if (!state.meta.start_date)  { toast.error("Preencha a data de início");      return; }

    setIsSaving(true);
    try {
      const wizardBlob = JSON.stringify({
        parties:              state.parties,
        variables:            state.variables,
        partyRoles:           state.partyRoles,
        manifestVars:         state.manifestVars,
        signatureRoles:       state.signatureRoles,
      });

      // FIX: "Guardar Rascunho" always forces status = "draft"
      const resolvedStatus = sendForSignature
        ? "awaiting_signature"
        : "draft";

      const provider = (state.signers.find((s) => s.provider)?.provider || null) as SigningPlatform | null;

      // FIX: build typed payload — no `as any`
      const payload: ContractInsert = {
        title:           state.meta.title.trim(),
        template_id:      state.templateId || null,
        type:             state.templateTipoServico || state.templateNome || null,
        status:           resolvedStatus,
        start_date:      state.meta.start_date || null,
        end_date:         state.meta.end_date    || null,
        observacoes:      wizardBlob,
        signing_platform: provider,
        // Deliberately map WizardSigner to the persisted WizardSignerRecord shape
        signers: state.signers.map(({ nome, email, role, obrigatorio, ordem, provider }): WizardSignerRecord => ({
          name: nome, nome, email, role, obrigatorio, ordem, provider,
        })),
      };

      if (isEdit && contrato) {
        try {
          await updateContract.mutateAsync({
            id: contrato.id,
            ...payload,
            expectedUpdatedAt: getExpectedUpdatedAt(contrato),
          });
        } catch (err) {
          if (handleConcurrencyConflict(err, "contrato")) return;
          return;
        }
      } else {
        try {
          await addContract.mutateAsync(payload);
        } catch {
          return;
        }
      }

      if (sendForSignature) {
        toast.error(`Integração com ${provider || "plataforma"} não configurada`);
        throw new Error(`Integração com ${provider || "plataforma"} não configurada`);
      }
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Step content ─────────────────────────────────────────────────────────

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return (
          <StepTemplate
            state={state}
            onSelect={handleSelectTemplate}
            categories={categories}
          />
        );
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preencha os dados de cada parte. Detectadas automaticamente dos placeholders do template.
            </p>
            {state.partyRoles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma parte detectada. Verifique se o template contém placeholders como{" "}
                <code className="text-xs bg-muted px-1 rounded">{`{{REPRESENTANTE.NAME}}`}</code>.
              </div>
            ) : (
              state.partyRoles.map((role) => (
                <PartyCard
                  key={role}
                  role={role}
                  party={state.parties[role] || EMPTY_PARTY}
                  onChange={(p) => updateParty(role, p)}
                />
              ))
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preencha as variáveis detectadas no template.
            </p>
            {state.manifestVars.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma variável adicional detectada neste template.
              </div>
            ) : (
              <div className="grid gap-3">
                {state.manifestVars.map((mv) => (
                  <VariableField
                    key={mv.key}
                    manifest={mv}
                    value={state.variables[mv.key] || ""}
                    onChange={(v) => updateVariable(mv.key, v)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Revise o documento. Itens em <span className="bg-yellow-100 text-yellow-800 px-1 rounded text-xs">⚠ amarelo</span> ainda não preenchidos.
            </p>
            <div className="rounded-lg border border-border overflow-hidden" style={{ height: "420px" }}>
              <PreviewPanel
                state={state}
                headerImage={selectedTemplate?.header_image}
                footerImage={selectedTemplate?.footer_image}
              />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure os signatários. Roles detectados automaticamente dos placeholders{" "}
              <code className="text-[10px] bg-muted px-1 rounded">SIGNATURE.*</code>,{" "}
              <code className="text-[10px] bg-muted px-1 rounded">INITIALS.*</code>,{" "}
              <code className="text-[10px] bg-muted px-1 rounded">SIGN_DATE.*</code>.
            </p>
            {state.signers.map((signer) => (
              <SignerRow
                key={signer.id}
                signer={signer}
                onUpdate={(s) => updateSigner(signer.id, s)}
                onRemove={() => removeSigner(signer.id)}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={addSigner}
              type="button"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Adicionar Signatário
            </Button>
          </div>
        );
      case 6:
        return <ReviewStep state={state} onMeta={updateMeta} />;
      default:
        return null;
    }
  }, [step, state, handleSelectTemplate, categories, updateParty, updateVariable, updateSigner, removeSigner, addSigner, updateMeta, selectedTemplate]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-full p-0 overflow-hidden gap-0"
        style={{ height: "90vh" }}
      >
        <DialogTitle className="sr-only">
          {isEdit ? "Editar Contrato" : "Novo Contrato"}
        </DialogTitle>

        <div className="flex h-full overflow-hidden">

          {/* ── Step sidebar ─────────────────────────────────────────────── */}
          <div className="hidden md:flex flex-col w-52 border-r border-border bg-muted/30 shrink-0">
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold  tracking-wide text-muted-foreground">
                {isEdit ? "Editar Contrato" : "Novo Contrato"}
              </p>
              {state.templateNome && (
                <p className="text-xs text-foreground mt-1 font-medium truncate">{state.templateNome}</p>
              )}
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {WIZARD_STEPS.map((s, i) => {
                const n    = i + 1;
                const Icon = s.icon;
                const active = step === n;
                const done   = step > n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => n <= step && setStep(n)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors text-left",
                      active && "bg-primary text-primary-foreground font-medium",
                      !active && done && "text-foreground hover:bg-muted cursor-pointer",
                      !active && !done && "text-muted-foreground cursor-default",
                    )}
                  >
                    <span className={cn(
                      "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                      active && "bg-primary-foreground text-primary",
                      !active && done && "bg-primary/20 text-primary",
                      !active && !done && "bg-muted text-muted-foreground",
                    )}>
                      {done ? <Check className="h-3 w-3" /> : n}
                    </span>
                    <span>{s.label}</span>
                    {active && <Icon className="h-3 w-3 ml-auto opacity-60" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ── Form panel ───────────────────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Mobile step indicator */}
            <div className="flex md:hidden items-center gap-2 px-5 py-3 border-b border-border shrink-0">
              {WIZARD_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    step >= i + 1 ? "w-4 bg-primary" : "w-1.5 bg-muted",
                  )}
                />
              ))}
              <span className="ml-2 text-xs font-medium">{WIZARD_STEPS[step - 1]?.label}</span>
              <span className="text-xs text-muted-foreground">({step}/6)</span>
            </div>

            <ScrollArea className="flex-1 px-5 py-4">
              <div className="mx-auto w-full max-w-3xl">
                {stepContent}
              </div>
            </ScrollArea>

            {/* Footer navigation */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0 bg-background">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => step > 1 ? setStep((s) => s - 1) : onOpenChange(false)}
                disabled={isSaving}
                type="button"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {step === 1 ? "Cancelar" : "Voltar"}
              </Button>

              <div className="flex items-center gap-2">
                {step < 6 ? (
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!canAdvance || isSaving}
                    type="button"
                    data-testid="button-wizard-avancar"
                  >
                    Avançar
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleSave(false)}
                      disabled={!canAdvance || isSaving}
                      type="button"
                      data-testid="button-wizard-rascunho"
                    >
                      {isSaving ? "A guardar…" : "Guardar Rascunho"}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => handleSave(true)}
                      disabled={!canAdvance || isSaving || state.signers.length === 0}
                      type="button"
                      data-testid="button-wizard-assinar"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Enviar para Assinatura
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Live preview panel ───────────────────────────────────────── */}
          <div className="hidden lg:flex flex-col w-[45%] border-l border-border bg-muted/10 overflow-hidden">
            <PreviewPanel
              state={state}
              headerImage={selectedTemplate?.header_image}
              footerImage={selectedTemplate?.footer_image}
            />
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

