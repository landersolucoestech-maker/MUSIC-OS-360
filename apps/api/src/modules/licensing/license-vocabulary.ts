/**
 * license-vocabulary.ts — CZ-035: canonical (English) license values and the
 * only place that knows the pre-CZ-035 vocabulary.
 *
 * The web form used to store slugified PT-BR labels (status "negociacao",
 * target media "tv_aberta", territory "américa_latina", ...). A web build
 * released before CZ-035 still sends them, plus the Portuguese field names;
 * they are accepted as deprecated input and mapped here before persistence.
 * Mirrors migration 20260928000013_CanonicalizeLicensesToEnglish.
 */
import { LicenseStatus } from '@music-os-360/types';
import type { DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const LICENSE_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  obra_musical: 'work_title',
  artista: 'artist_name',
  cliente: 'client_name',
  projeto: 'project_name',
  tipo_uso: 'usage_type',
  midia_destino: 'target_media',
  territorio: 'territory',
  valor: 'amount',
  moeda: 'currency',
};

export const LICENSE_QUERY_DEPRECATED_FIELDS: DeprecatedFieldAliases = { midia_destino: 'target_media' };

export const LICENSE_STATUSES = Object.values(LicenseStatus) as string[];

const LEGACY_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  status: {
    ativa: LicenseStatus.ACTIVE, negociacao: LicenseStatus.NEGOTIATION, proposta: LicenseStatus.PROPOSAL,
    expirada: LicenseStatus.EXPIRED, pendente: LicenseStatus.PENDING,
  },
  type: { sync_publicidade: 'sync_advertising', 'mecânica': 'mechanical', mecanica: 'mechanical' },
  target_media: {
    tv_aberta: 'free_tv', tv_fechada: 'pay_tv', redes_sociais: 'social_media',
    publicidade_digital: 'digital_advertising', outro: 'other',
  },
  territory: {
    brasil: 'brazil', 'américa_latina': 'latin_america', america_latina: 'latin_america', mundial: 'worldwide',
    estados_unidos: 'united_states', europa: 'europe', 'ásia': 'asia',
  },
};

/** Every status value the API accepts on input (canonical first, then deprecated). */
export const ACCEPTED_LICENSE_STATUSES = [...LICENSE_STATUSES, ...Object.keys(LEGACY_VALUES['status'])];

export function canonicalLicenseValue(field: keyof typeof LEGACY_VALUES | string, value: unknown): unknown {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(LEGACY_VALUES, field)) return value;
  const map = LEGACY_VALUES[field as keyof typeof LEGACY_VALUES] as Readonly<Record<string, string>>;
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

/** Comma-separated status filter ("negotiation,proposal") with legacy values mapped. */
export function canonicalLicenseStatusFilter(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => canonicalLicenseValue('status', s) as string);
}
