/**
 * client-legacy-fields.ts — CZ-043 deploy-skew compatibility for the client
 * (CRM contact) contract.
 *
 * A web build released before CZ-043 sends the camelCase/Portuguese keys and
 * Portuguese values below (plus a "payloadOperacional" copy of the form inside
 * `metadata`); they are mapped to the canonical snake_case contract before
 * validation-free persistence. Responses are canonical and carry no metadata.
 * Plaintext cpf/cnpj are never persisted in metadata again
 * (BLK-CRM-PII-PLAINTEXT covers the historical copies).
 */
import { applyDeprecatedFieldAliases, type DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import { INTERACTION_KEYS, INTERACTION_TYPES } from '../leads/lead-vocabulary';

export const CLIENT_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  type: 'person_type',
  document: 'cpf_cnpj',
  avatarUrl: 'photo_url',
  zipCode: 'zip_code',
  responsible: 'responsible_name',
  nome: 'name',
  tipo_pessoa: 'person_type',
  categoria: 'category',
  perfil: 'profile',
  foto: 'photo_url',
  razao_social: 'legal_name',
  nome_fantasia: 'trade_name',
  nome_pf: 'individual_name',
  funcao: 'job_title',
  logradouro: 'street',
  numero: 'street_number',
  complemento: 'address_complement',
  bairro: 'neighborhood',
  cidade: 'city',
  estado: 'state',
  cep: 'zip_code',
  endereco_completo: 'address',
  prioridade_contato: 'priority',
  responsavel_nome: 'responsible_name',
  responsavel_cargo: 'responsible_job_title',
  responsavel_email: 'responsible_email',
  responsavel_telefone: 'responsible_phone',
  telefone: 'phone',
  observacoes: 'notes',
  interacoes: 'interactions',
};

export const CLIENT_PERSON_TYPES = ['individual', 'company'] as const;
export const CLIENT_PRIORITIES = ['low', 'medium', 'high', 'strategic'] as const;
export const CLIENT_INTERACTION_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'proposal', 'follow_up', 'note'] as const;
export const CLIENT_TIMELINE_TYPES = ['note', 'call', 'meeting', 'email', 'whatsapp', 'other'] as const;

const LEGACY_PERSON_TYPES: Readonly<Record<string, string>> = {
  person: 'individual', pessoa_fisica: 'individual', pessoa_juridica: 'company',
};
export const LEGACY_TIMELINE_TYPES: Readonly<Record<string, string>> = {
  nota: 'note', ligacao: 'call', reuniao: 'meeting', outro: 'other',
};
/** Keys of the pre-CZ-043 "payloadOperacional" metadata copy — never persisted again. */
const LEGACY_METADATA_FORM_KEYS = [
  'tipo_pessoa', 'perfil', 'cpf', 'cnpj', 'razao_social', 'nome_fantasia', 'funcao', 'foto', 'cep', 'logradouro',
  'numero', 'complemento', 'bairro', 'responsavel_nome', 'responsavel_email', 'responsavel_telefone',
  'responsavel_cargo', 'interacoes',
] as const;

const mapValue = (map: Readonly<Record<string, string>>, value: unknown): unknown =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value.trim().toLowerCase())
    ? map[value.trim().toLowerCase()]
    : value;

export const canonicalClientPersonType = (value: unknown): unknown => mapValue(LEGACY_PERSON_TYPES, value);
export const canonicalClientTimelineType = (value: unknown): unknown => mapValue(LEGACY_TIMELINE_TYPES, value);

/** Interaction items: data/horario/descricao -> date/time/description; PT types -> English (lead vocabulary). */
export function canonicalClientInteractions(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    const out = applyDeprecatedFieldAliases(item as Record<string, unknown>, INTERACTION_KEYS);
    if (typeof out['type'] === 'string') out['type'] = mapValue(INTERACTION_TYPES, out['type']);
    return out;
  });
}

/** A pre-CZ-043 build always sends deprecated keys (zipCode/responsible/type) or the payloadOperacional copy. */
function isPreCz043Payload(raw: Record<string, unknown>): boolean {
  if (Object.keys(raw).some((key) => Object.prototype.hasOwnProperty.call(CLIENT_DEPRECATED_FIELDS, key))) return true;
  const meta = raw['metadata'];
  return meta !== null && typeof meta === 'object' && !Array.isArray(meta)
    && LEGACY_METADATA_FORM_KEYS.some((key) => key in (meta as Record<string, unknown>));
}

/**
 * On EDIT, a pre-CZ-043 build re-sends values it could not read from the
 * canonical response: its defaults for type (company), priority ('medium') and
 * status ('active'), and empty interaction lists. They are dropped instead of
 * overwriting the stored data (same rule as works/phonograms/artists).
 */
function dropUnreadableLegacyEditValues(raw: Record<string, unknown>): void {
  delete raw['type'];
  delete raw['tipo_pessoa'];
  if (raw['priority'] === 'medium') delete raw['priority'];
  if (raw['status'] === 'active') delete raw['status'];
  const meta = raw['metadata'];
  if (meta !== null && typeof meta === 'object' && !Array.isArray(meta)) {
    const m = { ...(meta as Record<string, unknown>) };
    delete m['tipo_pessoa'];
    if (Array.isArray(m['interacoes']) && m['interacoes'].length === 0) delete m['interacoes'];
    raw['metadata'] = m;
  }
}

/**
 * Maps every deprecated CZ-043 key/value of a client payload to the canonical
 * contract. The legacy "payloadOperacional" inside metadata is unfolded into
 * the columns (only where the top-level canonical field is absent) and
 * removed — including the plaintext cpf/cnpj, which move to `cpf_cnpj` (stored
 * encrypted) when no document was sent.
 */
export function canonicalizeClientInput<T extends object>(input: T, options: { update?: boolean } = {}): T {
  const raw = { ...(input as Record<string, unknown>) };
  if (options.update && isPreCz043Payload(raw)) dropUnreadableLegacyEditValues(raw);
  const metadata = raw['metadata'];
  if (metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const meta = { ...(metadata as Record<string, unknown>) };
    const document = meta['cpf'] || meta['cnpj'];
    for (const key of LEGACY_METADATA_FORM_KEYS) {
      if (key !== 'cpf' && key !== 'cnpj' && raw[key] === undefined && meta[key] !== undefined && meta[key] !== '') {
        raw[key] = meta[key];
      }
      delete meta[key];
    }
    if (raw['document'] === undefined && raw['cpf_cnpj'] === undefined && typeof document === 'string' && document) {
      raw['cpf_cnpj'] = document;
    }
    raw['metadata'] = meta;
  }
  const out = applyDeprecatedFieldAliases(raw, CLIENT_DEPRECATED_FIELDS);
  if (out['person_type'] !== undefined) out['person_type'] = canonicalClientPersonType(out['person_type']);
  if (out['interactions'] !== undefined) out['interactions'] = canonicalClientInteractions(out['interactions']);
  return out as T;
}

/** Pre-CZ-043 query names/values (`type` person/company). */
export function canonicalizeClientQuery<T extends object>(query: T): T {
  const out = applyDeprecatedFieldAliases({ ...(query as Record<string, unknown>) }, { type: 'person_type' });
  if (out['person_type'] !== undefined) out['person_type'] = canonicalClientPersonType(out['person_type']);
  return out as T;
}
