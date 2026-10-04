import { LicenseStatus } from '@music-os-360/types';
import {
  ACCEPTED_LICENSE_STATUSES,
  canonicalLicenseStatusFilter,
  canonicalLicenseValue,
  LICENSE_DEPRECATED_FIELDS,
  LICENSE_QUERY_DEPRECATED_FIELDS,
} from './license-vocabulary';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

describe('license legacy request vocabulary (legacy in, canonical out)', () => {
  it.each([
    ['status', 'ativa', LicenseStatus.ACTIVE],
    ['status', 'negociacao', LicenseStatus.NEGOTIATION],
    ['status', 'proposta', LicenseStatus.PROPOSAL],
    ['status', 'expirada', LicenseStatus.EXPIRED],
    ['status', 'pendente', LicenseStatus.PENDING],
    ['type', 'sync_publicidade', 'sync_advertising'],
    ['type', 'mecanica', 'mechanical'],
    ['target_media', 'tv_aberta', 'free_tv'],
    ['target_media', 'redes_sociais', 'social_media'],
    ['territory', 'brasil', 'brazil'],
    ['territory', 'america_latina', 'latin_america'],
    ['territory', 'mundial', 'worldwide'],
  ])('%s value %s is read as %s', (field, legacy, canonical) => {
    expect(canonicalLicenseValue(field, legacy)).toBe(canonical);
    expect(canonicalLicenseValue(field, canonical)).toBe(canonical);
  });

  it('non-string and unknown values are untouched', () => {
    expect(canonicalLicenseValue('status', 7)).toBe(7);
    expect(canonicalLicenseValue('status', 'custom')).toBe('custom');
  });

  it('status filter maps legacy members and still accepts them as input', () => {
    expect(canonicalLicenseStatusFilter('negociacao, proposal,')).toEqual([LicenseStatus.NEGOTIATION, 'proposal']);
    expect(ACCEPTED_LICENSE_STATUSES).toEqual(expect.arrayContaining(['negociacao', LicenseStatus.NEGOTIATION]));
  });

  it('deprecated request fields move to the canonical names and the legacy key is dropped', () => {
    const out = applyDeprecatedFieldAliases(
      { obra_musical: 'W', midia_destino: 'tv_aberta', valor: '5', moeda: 'BRL' },
      LICENSE_DEPRECATED_FIELDS,
    ) as Record<string, unknown>;
    expect(out).toEqual({ work_title: 'W', target_media: 'tv_aberta', amount: '5', currency: 'BRL' });
    expect(applyDeprecatedFieldAliases({ midia_destino: 'x' }, LICENSE_QUERY_DEPRECATED_FIELDS)).toEqual({ target_media: 'x' });
  });
});

// Exhaustive pins: explicit static tables (not derived from the module under test), one case per legacy name.
const LEGACY_VALUE_TABLE: ReadonlyArray<readonly [string, string, string]> = [
  ['status', 'ativa', 'active'],
  ['status', 'negociacao', 'negotiation'],
  ['status', 'proposta', 'proposal'],
  ['status', 'expirada', 'expired'],
  ['status', 'pendente', 'pending'],
  ['type', 'sync_publicidade', 'sync_advertising'],
  ['type', 'mecânica', 'mechanical'],
  ['type', 'mecanica', 'mechanical'],
  ['target_media', 'tv_aberta', 'free_tv'],
  ['target_media', 'tv_fechada', 'pay_tv'],
  ['target_media', 'redes_sociais', 'social_media'],
  ['target_media', 'publicidade_digital', 'digital_advertising'],
  ['target_media', 'outro', 'other'],
  ['territory', 'brasil', 'brazil'],
  ['territory', 'américa_latina', 'latin_america'],
  ['territory', 'america_latina', 'latin_america'],
  ['territory', 'mundial', 'worldwide'],
  ['territory', 'estados_unidos', 'united_states'],
  ['territory', 'europa', 'europe'],
  ['territory', 'ásia', 'asia'],
];

const DEPRECATED_FIELD_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['obra_musical', 'work_title'],
  ['artista', 'artist_name'],
  ['cliente', 'client_name'],
  ['projeto', 'project_name'],
  ['tipo_uso', 'usage_type'],
  ['midia_destino', 'target_media'],
  ['territorio', 'territory'],
  ['valor', 'amount'],
  ['moeda', 'currency'],
];

describe('license legacy vocabulary: every legacy value and field name, one by one', () => {
  it.each(LEGACY_VALUE_TABLE)('%s value "%s" is read as "%s"; the canonical value is unchanged', (field, legacy, canonical) => {
    expect(canonicalLicenseValue(field, legacy)).toBe(canonical);
    expect(canonicalLicenseValue(field, canonical)).toBe(canonical);
  });

  it('a legacy value of one field is not translated under another field', () => {
    expect(canonicalLicenseValue('type', 'ativa')).toBe('ativa');
    expect(canonicalLicenseValue('status', 'brasil')).toBe('brasil');
  });

  it.each(LEGACY_VALUE_TABLE.filter(([field]) => field === 'status'))('status filter maps member "%s" to "%s" and ACCEPTED_LICENSE_STATUSES still accepts it', (_f, legacy, canonical) => {
    expect(canonicalLicenseStatusFilter(` ${legacy} `)).toEqual([canonical]);
    expect(ACCEPTED_LICENSE_STATUSES).toContain(legacy);
    expect(ACCEPTED_LICENSE_STATUSES).toContain(canonical);
  });

  it('LICENSE_DEPRECATED_FIELDS declares exactly the expected legacy -> canonical pairs', () => {
    expect({ ...LICENSE_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(DEPRECATED_FIELD_TABLE));
    expect({ ...LICENSE_QUERY_DEPRECATED_FIELDS }).toEqual({ midia_destino: 'target_media' });
  });

  it.each(DEPRECATED_FIELD_TABLE)('request field %s -> %s: legacy-only moves, the CANONICAL value wins when both are sent', (legacy, canonical) => {
    const only = applyDeprecatedFieldAliases({ [legacy]: 'legacy-value' }, LICENSE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(only).toEqual({ [canonical]: 'legacy-value' });
    const both = applyDeprecatedFieldAliases({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }, LICENSE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(both).toEqual({ [canonical]: 'canonical-value' });
  });

  it('query field midia_destino: legacy-only moves, canonical wins when both are sent', () => {
    expect(applyDeprecatedFieldAliases({ midia_destino: 'a' }, LICENSE_QUERY_DEPRECATED_FIELDS)).toEqual({ target_media: 'a' });
    expect(applyDeprecatedFieldAliases({ midia_destino: 'a', target_media: 'b' }, LICENSE_QUERY_DEPRECATED_FIELDS)).toEqual({ target_media: 'b' });
  });
});
