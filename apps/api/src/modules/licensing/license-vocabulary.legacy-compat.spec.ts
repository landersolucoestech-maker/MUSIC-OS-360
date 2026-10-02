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
