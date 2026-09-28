/**
 * release-legacy-fields.ts — CZ-038 deploy-skew compatibility for the release
 * contract.
 *
 * A web build released before CZ-038 sends the Portuguese field names, type
 * values and jsonb keys below; they are accepted as deprecated input and
 * mapped here before persistence. Responses are canonical (English).
 */
import { applyDeprecatedFieldAliases, type DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const RELEASE_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  notas_internas: 'internal_notes',
  gravadora: 'record_label',
  idioma: 'language',
  cronograma: 'schedule',
};

export const RELEASE_SCHEDULE_DEPRECATED_KEYS: DeprecatedFieldAliases = {
  data_gravacao: 'recording_date',
  data_mix_master: 'mix_master_date',
  data_entrega_distribuidora: 'distributor_delivery_date',
};

export const RELEASE_ASSET_DEPRECATED_KEYS: DeprecatedFieldAliases = {
  capa_url: 'cover_url',
  video_clipe_url: 'music_video_url',
  letra: 'lyrics',
  ficha_tecnica: 'credits',
};

export const RELEASE_TYPES = ['album', 'ep', 'single', 'compilation', 'live', 'other'] as const;
export type ReleaseTypeValue = typeof RELEASE_TYPES[number];

export const RELEASE_LEGACY_TYPES: Readonly<Record<string, ReleaseTypeValue>> = {
  compilacao: 'compilation',
  outro: 'other',
};

function canonicalObjectKeys(value: unknown, aliases: DeprecatedFieldAliases): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  return applyDeprecatedFieldAliases(value as Record<string, unknown>, aliases);
}

/** Maps every deprecated CZ-038 name, value and jsonb key of a release payload to its canonical form. */
export function canonicalizeReleaseInput<T extends object>(input: T): T {
  const out = applyDeprecatedFieldAliases(input as Record<string, unknown>, RELEASE_DEPRECATED_FIELDS);
  if (typeof out['type'] === 'string' && RELEASE_LEGACY_TYPES[out['type']]) out['type'] = RELEASE_LEGACY_TYPES[out['type']];
  if (out['schedule'] !== undefined) out['schedule'] = canonicalObjectKeys(out['schedule'], RELEASE_SCHEDULE_DEPRECATED_KEYS);
  if (out['assets'] !== undefined) out['assets'] = canonicalObjectKeys(out['assets'], RELEASE_ASSET_DEPRECATED_KEYS);
  return out as T;
}
