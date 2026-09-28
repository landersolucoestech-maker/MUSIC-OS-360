/**
 * artist-legacy-fields.ts — CZ-042 deploy-skew compatibility for the artist
 * contract (migration 20260928000022_CanonicalizeArtistsToEnglish).
 *
 * A web build released before CZ-042 sends the Portuguese field names, values
 * and nested jsonb keys below; they are accepted as deprecated input (declared
 * `deprecated` on CreateArtistDto so the global pipe lets them through) and
 * mapped here before anything past the controller sees them. Every form field
 * has its own physical column (the single source of truth); `metadata` keeps
 * only the metadata-only fields (ARTIST_METADATA_ONLY_FIELDS). Responses are
 * canonical (English keys and values).
 */
import { applyDeprecatedFieldAliases, type DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

/** Pre-CZ-042 request key -> canonical key (column name, encrypted wire key or metadata key). */
export const ARTIST_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  nome_artistico: 'stage_name',
  nome_civil: 'full_name',
  foto_url: 'photo_url',
  galeria_urls: 'gallery_urls',
  especialidades: 'specialties',
  documentos_pessoais_url: 'personal_documents_url',
  presskit_url: 'press_kit_url',
  data_nascimento: 'birth_date',
  endereco: 'address',
  telefone: 'phone',
  banco: 'bank_name',
  agencia: 'bank_branch',
  conta: 'bank_account',
  chave_pix: 'pix_key',
  titular_conta: 'account_holder',
  tipo_perfil: 'profile_type',
  slug_artistico: 'artist_slug',
  tags_musicais: 'music_tags',
  fase_carreira: 'career_stage',
  relacionamentos: 'relationships',
  empresario_id: 'agent_id',
  empresario_nome: 'agent_name',
  empresario_telefone: 'agent_phone',
  empresario_email: 'agent_email',
  gravadora_id: 'record_label_id',
  gravadora_nome: 'record_label_name',
  gravadora_telefone: 'record_label_phone',
  gravadora_email: 'record_label_email',
  gravadora_responsavel_id: 'record_label_contact_id',
  gravadora_responsavel_nome: 'record_label_contact_name',
  gravadora_responsavel_telefone: 'record_label_contact_phone',
  gravadora_responsavel_email: 'record_label_contact_email',
  distribuidoras_selecionadas: 'selected_distributors',
  distribuidoras_emails: 'distributor_emails',
  distribuidoras_empresa_selecionadas: 'company_selected_distributors',
  distribuidoras_empresa_emails: 'company_distributor_emails',
  distribuidoras_gerais: 'general_distributors',
  contatos_vinculados: 'linked_contacts',
  contatos_equipe: 'team_contacts',
  notas_internas: 'internal_notes',
  manager_nome: 'manager_name',
  manager_contato: 'manager_contact',
  produtor_executivo: 'executive_producer',
  agencia_booking: 'booking_agency',
  label_parceira: 'partner_label',
  contrato_id: 'contract_id',
  // metadata-only fields
  genero: 'gender',
  spotify_ouvintes: 'spotify_listeners',
  youtube_inscritos: 'youtube_subscribers',
  deezer_fas: 'deezer_fans',
  apple_music_albuns_url: 'apple_music_albums',
  soundcloud_seguidores_url: 'soundcloud_followers',
  instagram_seguidores: 'instagram_followers',
  tiktok_seguidores: 'tiktok_followers',
};

/**
 * The only keys the API reads from / returns out of `artists.metadata`. The
 * pre-CZ-042 Portuguese metadata keys stay in the row as historical data and
 * are never read or returned.
 */
export const ARTIST_METADATA_ONLY_FIELDS = [
  'gender',
  'instagram_url',
  'tiktok_url',
  'spotify_listeners',
  'youtube_subscribers',
  'deezer_fans',
  'apple_music_albums',
  'soundcloud_followers',
  'instagram_followers',
  'tiktok_followers',
] as const;

/** Keys of the objects nested in relationships / linked_contacts / team_contacts / general_distributors / documents. */
export const ARTIST_NESTED_DEPRECATED_KEYS: DeprecatedFieldAliases = {
  nome: 'name',
  telefone: 'phone',
  escritorio: 'office',
  responsaveis: 'responsibles',
  distribuidoras: 'distributors',
  nomeCustom: 'customName',
  categoria: 'category',
};

/** jsonb columns whose items carry ARTIST_NESTED_DEPRECATED_KEYS. */
export const ARTIST_NESTED_JSON_COLUMNS = [
  'relationships', 'linked_contacts', 'team_contacts', 'general_distributors', 'documents',
] as const;

export const ARTIST_SPECIALTIES = ['dj', 'dj_producer', 'songwriter', 'performer', 'producer'] as const;
export const ARTIST_PROFILE_TYPES = ['independent', 'managed', 'record_label', 'publisher'] as const;
export const ARTIST_RELATIONSHIP_TYPES = [
  'agent', 'record_label', 'publisher', 'booker', 'legal', 'finance', 'accountant', 'press_office',
] as const;
export const ARTIST_GENDERS = ['male', 'female'] as const;

/** Legacy Portuguese value -> canonical value (keys lower-case; lookup is case-insensitive). */
export const LEGACY_ARTIST_VALUES: Readonly<Record<'specialties' | 'profile_type' | 'relationship_type' | 'gender', Readonly<Record<string, string>>>> = {
  specialties: { dj_produtor: 'dj_producer', compositor_autor: 'songwriter', interprete: 'performer', produtor: 'producer' },
  profile_type: { independente: 'independent', com_empresario: 'managed', gravadora: 'record_label', editora: 'publisher' },
  relationship_type: {
    empresario: 'agent', gravadora: 'record_label', editora: 'publisher', juridico: 'legal',
    financeiro: 'finance', contador: 'accountant', assessoria: 'press_office',
  },
  gender: { masculino: 'male', feminino: 'female' },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const mapValue = (map: Readonly<Record<string, string>>, value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const key = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : value;
};

export const canonicalArtistProfileType = (value: unknown): unknown => mapValue(LEGACY_ARTIST_VALUES.profile_type, value);
export const canonicalArtistGender = (value: unknown): unknown => mapValue(LEGACY_ARTIST_VALUES.gender, value);

/** Canonical specialties list (legacy values mapped; unknown values kept). */
export function canonicalArtistSpecialties(value: unknown): unknown {
  return Array.isArray(value) ? value.map((v) => mapValue(LEGACY_ARTIST_VALUES.specialties, v)) : value;
}

/** Recursively renames the legacy nested keys of a jsonb value (arrays and objects). */
function canonicalNestedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalNestedKeys);
  if (!isPlainObject(value)) return value;
  const renamed = applyDeprecatedFieldAliases(value, ARTIST_NESTED_DEPRECATED_KEYS);
  for (const [key, inner] of Object.entries(renamed)) renamed[key] = canonicalNestedKeys(inner);
  return renamed;
}

/** Canonical jsonb value of a nested-item column (keys) — relationships also get canonical `type` values. */
export function canonicalArtistNestedColumn(column: string, value: unknown): unknown {
  const out = canonicalNestedKeys(value);
  if (column !== 'relationships' || !Array.isArray(out)) return out;
  return out.map((item) =>
    isPlainObject(item) && item.type !== undefined
      ? { ...item, type: mapValue(LEGACY_ARTIST_VALUES.relationship_type, item.type) }
      : item,
  );
}

/**
 * Canonical metadata object: legacy metadata-only keys renamed (never wiping a
 * canonical key with an empty legacy value) and the gender value mapped.
 */
export function canonicalArtistMetadata(value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const metadataAliases = Object.fromEntries(
    Object.entries(ARTIST_DEPRECATED_FIELDS).filter(([, canonical]) =>
      (ARTIST_METADATA_ONLY_FIELDS as readonly string[]).includes(canonical)),
  );
  const out = applyDeprecatedFieldAliases(value, metadataAliases);
  if (out.gender !== undefined) out.gender = canonicalArtistGender(out.gender);
  return out;
}

/**
 * Maps every deprecated CZ-042 name, value and nested key of an artist request
 * body to its canonical form. The canonical key wins when both are sent; an
 * empty deprecated value is dropped (never clears the canonical field).
 */
/**
 * On EDIT, a pre-CZ-042 build sends every field under its deprecated name with
 * a value it could not have read (the response carries only canonical names):
 * empty lists/maps, `false` flags and the form default tipo_perfil
 * 'independente'. Those are dropped instead of wiping the stored data
 * (same rule as works/phonograms — contract review of 353a967, F1).
 */
function dropUnreadableLegacyEditValues(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  for (const key of Object.keys(ARTIST_DEPRECATED_FIELDS)) {
    if (!(key in out)) continue;
    const value = out[key];
    const isEmptyList = Array.isArray(value) && value.length === 0;
    const isEmptyMap = value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
    if (isEmptyList || isEmptyMap || value === false || (key === 'tipo_perfil' && value === 'independente')) delete out[key];
  }
  return out;
}

export function canonicalizeArtistInput<T extends object>(input: T, options: { update?: boolean } = {}): T {
  const raw = options.update ? dropUnreadableLegacyEditValues(input as Record<string, unknown>) : (input as Record<string, unknown>);
  const out = applyDeprecatedFieldAliases(raw, ARTIST_DEPRECATED_FIELDS);
  if (out.specialties !== undefined) out.specialties = canonicalArtistSpecialties(out.specialties);
  if (out.profile_type !== undefined) out.profile_type = canonicalArtistProfileType(out.profile_type);
  if (out.gender !== undefined) out.gender = canonicalArtistGender(out.gender);
  for (const column of ARTIST_NESTED_JSON_COLUMNS) {
    if (out[column] !== undefined) out[column] = canonicalArtistNestedColumn(column, out[column]);
  }
  if (out.metadata !== undefined) out.metadata = canonicalArtistMetadata(out.metadata);
  return out as T;
}

/** Pre-CZ-042 `orderBy` values -> canonical column. */
export const ARTIST_DEPRECATED_ORDER_BY: Readonly<Record<string, string>> = {
  nome_artistico: 'stage_name',
  status_cadastro: 'registration_status',
};

/** Maps the pre-CZ-042 query values (orderBy). `vinculo` is handled by QueryArtistDto/ArtistsService. */
export function canonicalizeArtistQuery<T extends object>(query: T): T {
  const out = { ...(query as Record<string, unknown>) };
  if (typeof out.orderBy === 'string' && Object.prototype.hasOwnProperty.call(ARTIST_DEPRECATED_ORDER_BY, out.orderBy)) {
    out.orderBy = ARTIST_DEPRECATED_ORDER_BY[out.orderBy];
  }
  return out as T;
}
