/**
 * work-legacy-fields.ts — CZ-039 deploy-skew compatibility for the work
 * contract.
 *
 * A web build released before CZ-039 sends the Portuguese field names, values,
 * participant keys/roles and query values below; they are accepted as
 * deprecated input and mapped here before persistence. Responses are canonical
 * (English). The five Portuguese form fields that duplicated a registry column
 * (idioma, instrumental, criada_por_ia, outros_titulos, letra_completa) map
 * onto that registry column, which is the single source of truth.
 */
import { applyDeprecatedFieldAliases, type DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const WORK_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  compositor: 'composer_name',
  compositores: 'composer_names',
  editora: 'publisher_name',
  cod_entidade: 'society_code',
  cod_ecad: 'ecad_code',
  tipo_ia: 'ai_usage_level',
  ia_harmonia: 'ai_harmony',
  ia_melodia: 'ai_melody',
  ia_letra: 'ai_lyrics',
  referencias_conexas: 'related_references',
  letristas: 'translator_names',
  tipo_obra: 'work_origin',
  participantes: 'participants',
  idioma: 'language',
  instrumental: 'is_instrumental',
  criada_por_ia: 'ai_used',
  outros_titulos: 'alternative_titles',
  letra_completa: 'lyrics',
};

export const WORK_PARTICIPANT_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  classeFuncao: 'role',
  percentual: 'percentage',
  nome: 'name',
};

export const WORK_AI_ELEMENT_DEPRECATED_FIELDS: DeprecatedFieldAliases = { ferramenta: 'tool' };

export const WORK_PARTICIPANT_ROLES = ['publisher', 'administrator', 'composer_author', 'translator', 'unspecified'] as const;
export const WORK_ORIGINS = ['original', 'reference'] as const;
export const WORK_AI_USAGE_LEVELS = ['full', 'partial'] as const;

const LEGACY_PARTICIPANT_ROLES: Readonly<Record<string, string>> = {
  editor: 'publisher',
  administrador: 'administrator',
  'compositor/autor': 'composer_author',
  tradutor: 'translator',
  'não_informado': 'unspecified',
};

export const LEGACY_WORK_VALUES: Readonly<Record<'work_origin' | 'ai_usage_level' | 'type', Readonly<Record<string, string>>>> = {
  work_origin: { autoral: 'original', referencia: 'reference' },
  ai_usage_level: { totalmente: 'full', parcialmente: 'partial' },
  type: { composicao: 'composition', outro: 'other' },
};

/** PT-BR language label (pre-CZ-039 `idioma` value) -> ISO 639 code stored in `language`. */
export const LANGUAGE_LABEL_TO_CODE: Readonly<Record<string, string>> = {
  'Alemão': 'de', 'Amárico': 'am', 'Árabe': 'ar', 'Bengali': 'bn', 'Chinês Mandarim': 'zh',
  'Coreano': 'ko', 'Dinamarquês': 'da', 'Espanhol': 'es', 'Finlandês': 'fi', 'Francês': 'fr',
  'Grego': 'el', 'Hebraico': 'he', 'Hindi': 'hi', 'Holandês': 'nl', 'Indonésio': 'id',
  'Inglês': 'en', 'Iorubá': 'yo', 'Italiano': 'it', 'Japonês': 'ja', 'Latim': 'la',
  'Malaio': 'ms', 'Norueguês': 'no', 'Persa': 'fa', 'Polonês': 'pl', 'Português': 'pt',
  'Punjabi': 'pa', 'Russo': 'ru', 'Suaíli': 'sw', 'Sueco': 'sv', 'Tailandês': 'th',
  'Tamil': 'ta', 'Telugu': 'te', 'Turco': 'tr', 'Ucraniano': 'uk', 'Urdu': 'ur',
  'Vietnamita': 'vi', 'Zulu': 'zu', 'Cantonês': 'yue', 'Filipino': 'fil', 'Multilíngue': 'mul',
  // ISO 639-2 special codes: no linguistic content / undetermined.
  'Instrumental (Sem Letra)': 'zxx', 'Outro': 'und',
};

/** Query values sent by a pre-CZ-039 build. */
export const LEGACY_WORK_QUERY_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  project_id: { 'no-projeto': 'none', 'sem-projeto': 'none' },
  work_origin: LEGACY_WORK_VALUES.work_origin,
};

const mapValue = (map: Readonly<Record<string, string>>, value: unknown): unknown =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;

function canonicalAiElement(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  return applyDeprecatedFieldAliases(value as Record<string, unknown>, WORK_AI_ELEMENT_DEPRECATED_FIELDS);
}

function canonicalParticipant(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = applyDeprecatedFieldAliases(value as Record<string, unknown>, WORK_PARTICIPANT_DEPRECATED_FIELDS);
  if (typeof out['role'] === 'string') out['role'] = mapValue(LEGACY_PARTICIPANT_ROLES, out['role'].toLowerCase()) ?? out['role'];
  return out;
}

/** Canonical participant role (legacy Portuguese roles mapped; unknown values kept). */
export function canonicalWorkParticipantRole(role: unknown): string {
  if (typeof role !== 'string' || !role.trim()) return 'unspecified';
  const mapped = mapValue(LEGACY_PARTICIPANT_ROLES, role.toLowerCase());
  return typeof mapped === 'string' && (WORK_PARTICIPANT_ROLES as readonly string[]).includes(mapped) ? mapped : role;
}

/**
 * Deprecated keys an EDIT from a pre-CZ-039 build always sends with a value it
 * could not have read (the response carries only canonical names): its form
 * defaults (criada_por_ia/instrumental false, tipo_obra 'referencia') and an
 * empty participant list. On update they are dropped instead of overwriting
 * the stored canonical data (contract review of 353a967, F1).
 */
const UNREADABLE_ON_EDIT = ['criada_por_ia', 'instrumental', 'tipo_obra'] as const;

/**
 * Maps every deprecated CZ-039 name, value and nested key of a work payload to
 * its canonical form. The Portuguese duplicates of registry fields are
 * converted to the registry representation (language code, booleans).
 */
export function canonicalizeWorkInput<T extends object>(input: T, options: { update?: boolean } = {}): T {
  const raw = { ...(input as Record<string, unknown>) };
  if (options.update) {
    for (const key of UNREADABLE_ON_EDIT) delete raw[key];
    if (Array.isArray(raw['participantes']) && raw['participantes'].length === 0) delete raw['participantes'];
  }
  const legacyInstrumental = raw['instrumental'];
  const legacyLanguage = raw['idioma'];
  const out = applyDeprecatedFieldAliases(raw, WORK_DEPRECATED_FIELDS);
  if (out['language'] === legacyLanguage && typeof legacyLanguage === 'string') {
    out['language'] = LANGUAGE_LABEL_TO_CODE[legacyLanguage] ?? legacyLanguage;
  }
  if (out['is_instrumental'] === legacyInstrumental && typeof legacyInstrumental === 'string') {
    out['is_instrumental'] = legacyInstrumental === 'sim' ? true : legacyInstrumental === 'nao' ? false : null;
  }
  for (const column of ['work_origin', 'ai_usage_level', 'type'] as const) {
    if (out[column] !== undefined) out[column] = mapValue(LEGACY_WORK_VALUES[column], out[column]);
  }
  for (const column of ['ai_harmony', 'ai_melody', 'ai_lyrics']) {
    if (out[column] !== undefined) out[column] = canonicalAiElement(out[column]);
  }
  if (Array.isArray(out['participants'])) out['participants'] = out['participants'].map(canonicalParticipant);
  return out as T;
}

/** Maps pre-CZ-039 query names/values (tipo_obra, no-projeto). */
export function canonicalizeWorkQuery<T extends object>(query: T): T {
  const out = applyDeprecatedFieldAliases(query as Record<string, unknown>, { tipo_obra: 'work_origin' });
  for (const [column, map] of Object.entries(LEGACY_WORK_QUERY_VALUES)) {
    if (out[column] !== undefined) out[column] = mapValue(map, out[column]);
  }
  return out as T;
}
