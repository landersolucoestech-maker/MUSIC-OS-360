/**
 * takedown-legacy-fields.ts — CZ-034 deploy-skew compatibility for the
 * takedown contract.
 *
 * The canonical takedown fields and values are English. A web build released
 * before CZ-034 sends the Portuguese field names and the `type`/`priority`
 * slugs; they are accepted as deprecated input and mapped here — the only
 * place that knows this vocabulary — before persistence. Responses are
 * canonical.
 */
import type { DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const TAKEDOWN_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  obra_afetada: 'affected_work',
  artista: 'artist_name',
  plataforma: 'platform',
  url_infracao: 'infringing_url',
  motivo: 'reason',
  prioridade: 'priority',
  data_identificacao: 'identified_at',
  evidencias: 'evidence',
};

export const TAKEDOWN_QUERY_DEPRECATED_FIELDS: DeprecatedFieldAliases = { plataforma: 'platform' };

export const TAKEDOWN_TYPES = ['sent', 'received'] as const;
export const TAKEDOWN_PRIORITIES = ['high', 'medium', 'low'] as const;

const LEGACY_TYPES: Readonly<Record<string, (typeof TAKEDOWN_TYPES)[number]>> = { enviado: 'sent', recebido: 'received' };
const LEGACY_PRIORITIES: Readonly<Record<string, (typeof TAKEDOWN_PRIORITIES)[number]>> = {
  alta: 'high', media: 'medium', baixa: 'low',
};

/** Every value the API accepts on input (canonical first, then deprecated). */
export const ACCEPTED_TAKEDOWN_TYPES = [...TAKEDOWN_TYPES, ...Object.keys(LEGACY_TYPES)];
export const ACCEPTED_TAKEDOWN_PRIORITIES = [...TAKEDOWN_PRIORITIES, ...Object.keys(LEGACY_PRIORITIES)];

export function canonicalTakedownType<T>(value: T): T | string {
  return typeof value === 'string' ? (LEGACY_TYPES[value] ?? value) : value;
}

export function canonicalTakedownPriority<T>(value: T): T | string {
  return typeof value === 'string' ? (LEGACY_PRIORITIES[value] ?? value) : value;
}
