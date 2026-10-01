/**
 * Boundary between the placeholders users author in contract templates and the
 * canonical ids the wizard uses internally.
 *
 * USER-AUTHORED (persisted, never rewritten): `{{GROUP.FIELD}}` tokens inside
 * `contract_templates.content` and the keys of `contracts.notes` blob `variables`
 * / `manifestVars` (e.g. `{{CONTRATANTE.NOME_COMPLETO}}`, `{{CONTRATANTE.TELEFONE}}`).
 * Those spellings are user content in whatever language the author chose.
 *
 * INTERNAL (canonical English): `canonicalGroup` / `canonicalField` below, and the
 * `PartyData` key the field resolves to. Parsing, classification and resolution use
 * only the canonical ids; the raw token is kept next to them and is the only thing
 * ever written back (unresolved placeholders are returned verbatim).
 */
import type { PartyData } from "./contract-wizard-party";

export const PLACEHOLDER_RE = /\{\{([A-Z][A-Z0-9_]*)\.([A-Z0-9_]+)\}\}/g;

/** Authored field token -> canonical field id (also the PartyData key, upper-cased). */
const FIELD_TOKEN_TO_CANONICAL: Readonly<Record<string, string>> = {
  NAME: "NAME",
  NOME: "NAME",
  CPF: "CPF",
  CNPJ: "CNPJ",
  RG: "RG",
  EMAIL: "EMAIL",
  ADDRESS: "ADDRESS",
  ENDERECO: "ADDRESS",
  PHONE: "PHONE",
  TELEFONE: "PHONE",
  CELULAR: "PHONE",
  NATIONALITY: "NATIONALITY",
  NACIONALIDADE: "NATIONALITY",
  OCCUPATION: "OCCUPATION",
  PROFISSAO: "OCCUPATION",
  MARITAL_STATUS: "MARITAL_STATUS",
  ESTADO_CIVIL: "MARITAL_STATUS",
  LEGAL_NAME: "LEGAL_NAME",
  RAZAO_SOCIAL: "LEGAL_NAME",
  LEGAL_REPRESENTATIVE: "LEGAL_REPRESENTATIVE",
  REPRESENTANTE_LEGAL: "LEGAL_REPRESENTATIVE",
  REPRESENTATIVE_NAME: "LEGAL_REPRESENTATIVE",
  LEGAL_REPRESENTATIVE_CPF: "LEGAL_REPRESENTATIVE_CPF",
  CPF_REPRESENTANTE: "LEGAL_REPRESENTATIVE_CPF",
  LEGAL_REPRESENTATIVE_RG: "LEGAL_REPRESENTATIVE_RG",
  RG_REPRESENTANTE: "LEGAL_REPRESENTATIVE_RG",
  LEGAL_REPRESENTATIVE_NATIONALITY: "LEGAL_REPRESENTATIVE_NATIONALITY",
  LEGAL_REPRESENTATIVE_MARITAL_STATUS: "LEGAL_REPRESENTATIVE_MARITAL_STATUS",
  LEGAL_REPRESENTATIVE_OCCUPATION: "LEGAL_REPRESENTATIVE_OCCUPATION",
  LEGAL_REPRESENTATIVE_ADDRESS: "LEGAL_REPRESENTATIVE_ADDRESS",
  STAGE_NAME: "STAGE_NAME",
  NOME_ARTISTICO: "STAGE_NAME",
  FULL_NAME: "FULL_NAME",
  NOME_CIVIL: "FULL_NAME",
};

/** Authored non-party group token -> canonical group id. Party roles (CONTRATANTE, ...) are user content and keep their token. */
const NON_PARTY_GROUP_TO_CANONICAL: Readonly<Record<string, string>> = {
  SIGNATURE: "SIGNATURE",
  INITIALS: "INITIALS",
  SIGN_DATE: "SIGN_DATE",
  CONTRACT: "CONTRACT",
  FINANCIAL: "FINANCIAL",
  VIGENCIA: "TERM",
  OBRA: "WORK",
  OBRA_MUSICAL: "WORK",
  SYSTEM: "SYSTEM",
  DATA: "DATE",
  PRAZO: "DEADLINE",
  PENALTY: "PENALTY",
};

export const SIGNATURE_GROUPS: ReadonlySet<string> = new Set(["SIGNATURE", "INITIALS", "SIGN_DATE"]);

function has(map: Readonly<Record<string, string>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

export interface ParsedPlaceholder {
  /** The exact user-authored token, e.g. `{{CONTRATANTE.TELEFONE}}` — the only form ever persisted. */
  raw: string;
  /** Authored group / field tokens. */
  group: string;
  field: string;
  /** Canonical ids for internal processing. */
  canonicalGroup: string;
  canonicalField: string;
}

export function canonicalPlaceholderField(field: string): string {
  const f = field.toUpperCase();
  return has(FIELD_TOKEN_TO_CANONICAL, f) ? FIELD_TOKEN_TO_CANONICAL[f] : f;
}

export function canonicalPlaceholderGroup(group: string): string {
  return has(NON_PARTY_GROUP_TO_CANONICAL, group) ? NON_PARTY_GROUP_TO_CANONICAL[group] : group;
}

export function isNonPartyGroup(group: string): boolean {
  return has(NON_PARTY_GROUP_TO_CANONICAL, group);
}

export function isPartyEntityField(field: string): boolean {
  return has(FIELD_TOKEN_TO_CANONICAL, field.toUpperCase());
}

/** PartyData key a (canonical or authored) party field resolves to, or undefined for an unknown field. */
export function partyKeyForPlaceholderField(field: string): keyof PartyData | undefined {
  const f = field.toUpperCase();
  if (!has(FIELD_TOKEN_TO_CANONICAL, f)) return undefined;
  return FIELD_TOKEN_TO_CANONICAL[f].toLowerCase() as keyof PartyData;
}

export function parsePlaceholders(content: string): ParsedPlaceholder[] {
  const out: ParsedPlaceholder[] = [];
  for (const m of content.matchAll(PLACEHOLDER_RE)) {
    const [raw, group, field] = m;
    out.push({
      raw,
      group,
      field,
      canonicalGroup: canonicalPlaceholderGroup(group),
      canonicalField: canonicalPlaceholderField(field),
    });
  }
  return out;
}
