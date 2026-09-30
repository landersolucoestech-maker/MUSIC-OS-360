/**
 * Party and signer shapes persisted by ContractWizard (technical = English, UX = PT-BR).
 *
 * The wizard saves `parties` inside the JSON blob kept in `contracts.notes` and the signer
 * records in `contracts.signers` (opaque jsonb for the API). Drafts written before the
 * English rename still carry the Portuguese keys/values, so every READ goes through the
 * normalizers below, which map a known legacy key/value to its canonical one and let the
 * canonical key win when both are present. The wizard only ever WRITES canonical keys.
 */

import type { WizardSignerRecord } from "../types/contracts.types";

export type PartyType = "individual" | "company" | "artist";
export type PartyOrigin = "manual" | "crm" | "artists";

export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "stable_union"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export interface PartyData {
  type: PartyType;
  origin: PartyOrigin;
  sourceId?: string;
  name?: string;
  stage_name?: string;
  full_name?: string;
  cpf?: string;
  cnpj?: string;
  rg?: string;
  email?: string;
  phone?: string;
  address?: string;
  nationality?: string;
  occupation?: string;
  marital_status?: string;
  legal_name?: string;
  legal_representative?: string;
  legal_representative_cpf?: string;
  legal_representative_rg?: string;
  legal_representative_nationality?: string;
  legal_representative_marital_status?: string;
  legal_representative_occupation?: string;
  legal_representative_address?: string;
}

export const DEFAULT_PARTY: PartyData = { type: "individual", origin: "manual" };

// ─── PT-BR labels (the only place Portuguese text for these ids lives) ───────────

export const PARTY_TYPE_LABELS_PT_BR: Readonly<Record<PartyType, string>> = {
  individual: "Pessoa Física",
  company: "Pessoa Jurídica",
  artist: "Artista",
};

export const MARITAL_STATUS_LABELS_PT_BR: Readonly<Record<MaritalStatus, string>> = {
  single: "Solteiro(a)",
  married: "Casado(a)",
  divorced: "Divorciado(a)",
  widowed: "Viúvo(a)",
  stable_union: "União Estável",
};

/** Text written into the contract document for a marital status. */
export const MARITAL_STATUS_DOCUMENT_TEXT_PT_BR: Readonly<Record<MaritalStatus, string>> = {
  single: "solteiro",
  married: "casado",
  divorced: "divorciado",
  widowed: "viúvo",
  stable_union: "união estável",
};

export function maritalStatusDocumentText(value: string | undefined): string {
  if (!value) return "";
  return Object.prototype.hasOwnProperty.call(MARITAL_STATUS_DOCUMENT_TEXT_PT_BR, value)
    ? MARITAL_STATUS_DOCUMENT_TEXT_PT_BR[value as MaritalStatus]
    : value;
}

// ─── Deprecated (Portuguese) ids: READ-compat only, never written ───────────────

export const LEGACY_PARTY_FIELD_KEYS: Readonly<Record<string, keyof PartyData>> = {
  nome: "name",
  nome_artistico: "stage_name",
  nome_civil: "full_name",
  telefone: "phone",
  endereco: "address",
  nacionalidade: "nationality",
  profissao: "occupation",
  estado_civil: "marital_status",
  razao_social: "legal_name",
  representante_legal: "legal_representative",
  cpf_representante: "legal_representative_cpf",
  rg_representante: "legal_representative_rg",
  nacionalidade_representante: "legal_representative_nationality",
  estado_civil_representante: "legal_representative_marital_status",
  profissao_representante: "legal_representative_occupation",
  endereco_representante: "legal_representative_address",
};

export const LEGACY_PARTY_TYPES: Readonly<Record<string, PartyType>> = {
  pf: "individual",
  pj: "company",
  artista: "artist",
};

export const LEGACY_PARTY_ORIGINS: Readonly<Record<string, PartyOrigin>> = {
  artistas: "artists",
};

export const LEGACY_MARITAL_STATUSES: Readonly<Record<string, MaritalStatus>> = {
  solteiro: "single",
  casado: "married",
  divorciado: "divorced",
  viuvo: "widowed",
  uniao_estavel: "stable_union",
};

/** Canonical signer key -> deprecated Portuguese key it replaced (READ-compat only). */
export const LEGACY_SIGNER_FIELD_KEYS: Readonly<Record<"name" | "required" | "order", string>> = {
  name: "nome",
  required: "obrigatorio",
  order: "ordem",
};

function canonical<T extends string>(map: Readonly<Record<string, T>>, value: string): string {
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

const PARTY_TYPE_SET: ReadonlySet<string> = new Set<PartyType>(["individual", "company", "artist"]);
const PARTY_ORIGIN_SET: ReadonlySet<string> = new Set<PartyOrigin>(["manual", "crm", "artists"]);
const MARITAL_FIELDS: ReadonlySet<string> = new Set(["marital_status", "legal_representative_marital_status"]);

/**
 * Reads a persisted party (canonical or legacy) into the canonical shape. Unknown keys are
 * dropped; an unknown/missing type or origin falls back to the wizard's empty-party defaults.
 */
export function normalizeSavedParty(raw: unknown): PartyData {
  if (raw === null || typeof raw !== "object") return { ...DEFAULT_PARTY };
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  // Legacy keys first, so a canonical key present in the same record always wins.
  for (const [legacyKey, key] of Object.entries(LEGACY_PARTY_FIELD_KEYS)) {
    if (typeof input[legacyKey] === "string") out[key] = input[legacyKey];
  }
  for (const key of ["sourceId", "cpf", "cnpj", "rg", "email", "name", "stage_name", "full_name", "phone", "address", "nationality", "occupation", "marital_status", "legal_name", "legal_representative", "legal_representative_cpf", "legal_representative_rg", "legal_representative_nationality", "legal_representative_marital_status", "legal_representative_occupation", "legal_representative_address"]) {
    if (typeof input[key] === "string") out[key] = input[key];
  }
  for (const key of MARITAL_FIELDS) {
    if (typeof out[key] === "string") out[key] = canonical(LEGACY_MARITAL_STATUSES, out[key] as string);
  }

  const type = typeof input.type === "string" ? canonical(LEGACY_PARTY_TYPES, input.type) : "";
  const origin = typeof input.origin === "string" ? canonical(LEGACY_PARTY_ORIGINS, input.origin) : "";
  return {
    ...out,
    type: PARTY_TYPE_SET.has(type) ? (type as PartyType) : DEFAULT_PARTY.type,
    origin: PARTY_ORIGIN_SET.has(origin) ? (origin as PartyOrigin) : DEFAULT_PARTY.origin,
  };
}

/** True for a signer persisted by the wizard (canonical `required` or legacy `obrigatorio`). */
export function isWizardSignerRecord(signer: object): boolean {
  return "required" in signer || LEGACY_SIGNER_FIELD_KEYS.required in signer;
}

/** Reads a persisted wizard signer (canonical or legacy keys) into the canonical record. */
export function normalizeWizardSignerRecord(raw: unknown, index: number): WizardSignerRecord {
  const r = (raw !== null && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const read = (key: keyof typeof LEGACY_SIGNER_FIELD_KEYS): unknown => r[key] ?? r[LEGACY_SIGNER_FIELD_KEYS[key]];
  return {
    name: String(read("name") ?? ""),
    email: String(r.email ?? ""),
    role: String(r.role ?? "OUTRO"),
    required: Boolean(read("required") ?? true),
    order: Number(read("order") ?? index + 1),
    provider: typeof r.provider === "string" ? r.provider : "",
  };
}
