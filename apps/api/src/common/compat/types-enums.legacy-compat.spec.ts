import { FunctionalRole, toCanonicalRoleSlug, toLegacyRoleSlug, isLegacyRoleSlug } from '@music-os-360/types';

// Legacy FunctionalRole members/values stay persisted (org_members.role, roles.slug) and must
// keep being accepted on read, converting to the canonical English slug.
describe('packages/types enums legacy role members (legacy in, canonical out)', () => {
  const cases: Array<[member: keyof typeof FunctionalRole, legacyValue: string, canonical: string]> = [
    ['ARTISTA', 'artista', 'artist'],
    ['COLABORADOR', 'colaborador', 'collaborator'],
    ['COMERCIAL', 'comercial', 'sales'],
    ['JURIDICO', 'juridico', 'legal'],
    ['PRODUTOR', 'produtor', 'producer'],
    ['RH_MANAGER', 'rh_manager', 'hr_manager'],
  ];

  it.each(cases)('%s member keeps value %s and converts to %s', (member, legacyValue, canonical) => {
    expect(FunctionalRole[member]).toBe(legacyValue);
    expect(isLegacyRoleSlug(legacyValue)).toBe(true);
    expect(toCanonicalRoleSlug(legacyValue)).toBe(canonical);
    expect(toLegacyRoleSlug(canonical)).toBe(legacyValue);
    expect(isLegacyRoleSlug(canonical)).toBe(false);
  });

  it('does not map unknown or inherited keys', () => {
    expect(toCanonicalRoleSlug('constructor')).toBe('constructor');
    expect(toCanonicalRoleSlug('unknown_role')).toBe('unknown_role');
  });
});
