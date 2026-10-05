import { canonicalLeadServiceType, canonicalCrmInternalData } from './leads/lead-vocabulary';
import { canonicalReleaseType } from './releases/release-legacy-fields';
import { canonicalLicenseValue, canonicalLicenseStatusFilter } from './licensing/license-vocabulary';
import { canonicalInventoryStatus } from './inventory/inventory-legacy-fields';

/**
 * Legacy-value lookups run over user text. A key that exists on every object (`constructor`, `__proto__`, `toString`)
 * must come back unchanged, never as an inherited function/object, otherwise it is persisted or breaks the caller.
 */
const PROTOTYPE_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];

describe('legacy-value lookups ignore inherited object keys', () => {
  it.each(PROTOTYPE_KEYS)('lead service type %s is returned as the same string', (key) => {
    expect(canonicalLeadServiceType(key)).toBe(key);
  });

  it.each(PROTOTYPE_KEYS)('release type %s is returned as the same string', (key) => {
    expect(canonicalReleaseType(key)).toBe(key);
  });

  it.each(PROTOTYPE_KEYS)('license value %s is returned as the same string for status, type, target_media and territory', (key) => {
    for (const field of ['status', 'type', 'target_media', 'territory']) expect(canonicalLicenseValue(field, key)).toBe(key);
  });

  it.each(PROTOTYPE_KEYS)('an inherited field name %s is not treated as a license vocabulary field', (field) => {
    expect(canonicalLicenseValue(field, 'x')).toBe('x');
  });

  it('the license status filter keeps an inherited key as text', () => {
    expect(canonicalLicenseStatusFilter('constructor, negotiation')).toEqual(expect.arrayContaining(['constructor']));
    for (const v of canonicalLicenseStatusFilter('constructor,__proto__')) expect(typeof v).toBe('string');
  });

  it.each(PROTOTYPE_KEYS)('inventory status %s is returned as the same string', (key) => {
    expect(canonicalInventoryStatus(key)).toBe(key);
  });

  it('CRM internal data does not map an inherited key onto a value', () => {
    const out = canonicalCrmInternalData({ serviceType: 'constructor' }) as Record<string, unknown>;
    for (const v of Object.values(out)) expect(typeof v === 'function').toBe(false);
  });
});
