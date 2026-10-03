import { CLIENT_PROFILES, LEGACY_CLIENT_PROFILES, canonicalClientProfile, transformClientProfile } from './client-profile-vocabulary';
import {
  LEGACY_ORGANIZATION_INDUSTRIES,
  ORGANIZATION_INDUSTRIES,
  canonicalOrganizationIndustry,
  transformOrganizationIndustry,
} from '../auth/organization-industry';

// Direct tests of the reader functions (not of the migrations that backfilled the same aliases).
describe('organization-industry reader: legacy gravadora', () => {
  it('maps the deprecated gravadora to record_label, directly and through the class-transformer adapter', () => {
    expect(canonicalOrganizationIndustry('gravadora')).toBe('record_label');
    expect(canonicalOrganizationIndustry('  Gravadora ')).toBe('record_label');
    expect(transformOrganizationIndustry({ value: 'gravadora' })).toBe('record_label');
    expect(LEGACY_ORGANIZATION_INDUSTRIES.gravadora).toBe('record_label');
  });

  it('gravadora is a legacy alias only: never a canonical value, never persisted as-is', () => {
    expect((ORGANIZATION_INDUSTRIES as readonly string[]).includes('gravadora')).toBe(false);
    expect((ORGANIZATION_INDUSTRIES as readonly string[]).includes('record_label')).toBe(true);
  });

  it('unknown values are returned unchanged (never guessed)', () => {
    expect(canonicalOrganizationIndustry('gravadoras')).toBe('gravadoras');
    expect(canonicalOrganizationIndustry('label')).toBe('label');
  });
});

describe('client-profile-vocabulary reader: legacy outros and canonical inpi', () => {
  it('maps the deprecated outros to other, directly and through the class-transformer adapter', () => {
    expect(canonicalClientProfile('outros')).toBe('other');
    expect(canonicalClientProfile(' OUTROS ')).toBe('other');
    expect(transformClientProfile({ value: 'outros' })).toBe('other');
    expect(LEGACY_CLIENT_PROFILES.outros).toBe('other');
    expect((CLIENT_PROFILES as readonly string[]).includes('outros')).toBe(false);
  });

  it('inpi is a canonical value (proper noun), not an alias: kept as-is and absent from the legacy map', () => {
    expect((CLIENT_PROFILES as readonly string[]).includes('inpi')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(LEGACY_CLIENT_PROFILES, 'inpi')).toBe(false);
    expect(canonicalClientProfile('inpi')).toBe('inpi');
    expect(canonicalClientProfile(' INPI ')).toBe('inpi');
    expect(transformClientProfile({ value: 'inpi' })).toBe('inpi');
  });

  it('unknown values are returned unchanged (never guessed)', () => {
    expect(canonicalClientProfile('outro')).toBe('outro');
    expect(canonicalClientProfile('inpis')).toBe('inpis');
  });
});
