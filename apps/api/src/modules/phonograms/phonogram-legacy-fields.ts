/**
 * phonogram-legacy-fields.ts — CZ-040 deploy-skew compatibility for the
 * phonogram contract (title/work_id/artist_id aliases stay in
 * phonogram-legacy-alias.util.ts).
 *
 * A web build released before CZ-040 sends the Portuguese field names, values
 * and participation keys below; they are accepted as deprecated input and
 * mapped here before persistence. Responses are canonical (English). The
 * Portuguese duplicates of registry fields (gravacao_original,
 * data_lancamento, duracao_min/duracao_seg, pais_origem) map onto the registry
 * column, which is the single source of truth.
 */
import { applyDeprecatedFieldAliases, type DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const PHONOGRAM_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  gravadora: 'record_label_name',
  cod_entidade: 'society_code',
  cod_ecad: 'ecad_code',
  agregadora: 'aggregator',
  isrc_pais: 'isrc_country_code',
  isrc_registrante: 'isrc_registrant_code',
  isrc_ano: 'isrc_year',
  isrc_designacao: 'isrc_designation_code',
  criada_por_ia: 'ai_used',
  nacional: 'is_national',
  pub_simultanea: 'is_simultaneous_publication',
  emissao: 'issue_date',
  midia: 'media_type',
  classificacao: 'recording_classification',
  pais_publicacao: 'publication_country',
  pais_origem: 'country_of_recording',
  participacao: 'participation',
  arquivo_audio: 'audio_file',
  gravacao_original: 'recording_date',
  data_lancamento: 'release_date',
};

export const PHONOGRAM_PARTICIPATION_DEPRECATED_KEYS: DeprecatedFieldAliases = {
  produtorFonografico: 'phonographic_producers',
  interprete: 'performers',
  musicoAcompanhante: 'session_musicians',
};

export const PHONOGRAM_PARTICIPANT_DEPRECATED_FIELDS: DeprecatedFieldAliases = { percentual: 'percentage', nome: 'name' };

export const PHONOGRAM_MEDIA_TYPES = ['all', 'digital', 'physical', 'streaming'] as const;
export const PHONOGRAM_RECORDING_CLASSIFICATIONS = ['studio', 'live', 'remix', 'demo', 'other'] as const;

/** Legacy country values of the pre-CZ-040 form → ISO 3166-1 alpha-2 (ZZ = other/unknown). */
export const LEGACY_COUNTRY_TO_ISO: Readonly<Record<string, string>> = {
  brazil: 'BR', usa: 'US', uk: 'GB', portugal: 'PT', argentina: 'AR', outro: 'ZZ',
};

export const LEGACY_PHONOGRAM_VALUES: Readonly<Record<'media_type' | 'recording_classification' | 'aggregator', Readonly<Record<string, string>>>> = {
  media_type: { todos: 'all', 'físico': 'physical', fisico: 'physical' },
  recording_classification: { outro: 'other' },
  aggregator: { outro: 'other' },
};

const mapValue = (map: Readonly<Record<string, string>>, value: unknown): unknown =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value.toLowerCase()) ? map[value.toLowerCase()] : value;

/** Canonical country code (legacy lowercase names mapped; ISO codes upper-cased). */
export function canonicalCountryCode(value: unknown): unknown {
  if (typeof value !== 'string' || !value.trim()) return value;
  const mapped = mapValue(LEGACY_COUNTRY_TO_ISO, value.trim());
  return typeof mapped === 'string' && mapped.length === 2 ? mapped.toUpperCase() : mapped;
}

function canonicalParticipation(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = applyDeprecatedFieldAliases(value as Record<string, unknown>, PHONOGRAM_PARTICIPATION_DEPRECATED_KEYS);
  for (const [category, items] of Object.entries(out)) {
    if (!Array.isArray(items)) continue;
    out[category] = items.map((item) =>
      item !== null && typeof item === 'object' && !Array.isArray(item)
        ? applyDeprecatedFieldAliases(item as Record<string, unknown>, PHONOGRAM_PARTICIPANT_DEPRECATED_FIELDS)
        : item,
    );
  }
  return out;
}

/**
 * Deprecated keys an EDIT from a pre-CZ-040 build always sends with a value it
 * could not have read (the response carries only canonical names): its form
 * defaults for the flags (nacional true, criada_por_ia/pub_simultanea false)
 * and a participation object whose categories are all empty. On update they
 * are dropped instead of overwriting the stored data (contract review of
 * 353a967, F1).
 */
const UNREADABLE_ON_EDIT = ['criada_por_ia', 'nacional', 'pub_simultanea'] as const;

const isEmptyLegacyParticipation = (value: unknown): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.values(value as Record<string, unknown>).every((items) => !Array.isArray(items) || items.length === 0);

/**
 * Maps every deprecated CZ-040 name, value and nested key of a phonogram
 * payload to its canonical form. Legacy minutes/seconds become the total
 * `duration_seconds`.
 */
export function canonicalizePhonogramInput<T extends object>(input: T, options: { update?: boolean } = {}): T {
  const raw = { ...(input as Record<string, unknown>) };
  if (options.update) {
    for (const key of UNREADABLE_ON_EDIT) delete raw[key];
    if (isEmptyLegacyParticipation(raw['participacao'])) delete raw['participacao'];
  }
  const out = applyDeprecatedFieldAliases(raw, PHONOGRAM_DEPRECATED_FIELDS);
  const legacyMinutes = raw['duracao_min'];
  const legacySeconds = raw['duracao_seg'];
  delete out['duracao_min'];
  delete out['duracao_seg'];
  const hasLegacyDuration = (legacyMinutes != null && legacyMinutes !== '') || (legacySeconds != null && legacySeconds !== '');
  if (out['duration_seconds'] === undefined && hasLegacyDuration) {
    out['duration_seconds'] = Number(legacyMinutes ?? 0) * 60 + Number(legacySeconds ?? 0);
  }
  for (const column of ['media_type', 'recording_classification', 'aggregator'] as const) {
    if (out[column] !== undefined) out[column] = mapValue(LEGACY_PHONOGRAM_VALUES[column], out[column]);
  }
  for (const column of ['country_of_recording', 'publication_country']) {
    if (out[column] !== undefined) out[column] = canonicalCountryCode(out[column]);
  }
  if (out['participation'] !== undefined) out['participation'] = canonicalParticipation(out['participation']);
  return out as T;
}

/** Maps pre-CZ-040 query names/values (obra_vinculada sem-obra/com-obra, ecad com-ecad/sem-ecad). */
export function canonicalizePhonogramQuery<T extends object>(query: T): T {
  const out = { ...(query as Record<string, unknown>) };
  if (out['has_work'] === undefined && typeof out['obra_vinculada'] === 'string') {
    out['has_work'] = out['obra_vinculada'] === 'com-obra' ? 'true' : out['obra_vinculada'] === 'sem-obra' ? 'false' : undefined;
  }
  delete out['obra_vinculada'];
  if (out['ecad'] === 'com-ecad') out['ecad'] = 'with_code';
  else if (out['ecad'] === 'sem-ecad') out['ecad'] = 'without_code';
  return out as T;
}
