import { FunctionalRole, SystemRole, toCanonicalRoleSlug, toLegacyRoleSlug, isLegacyRoleSlug } from '@music-os-360/types';

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

// The legacy slugs are what org_members.role / roles.slug still persist: the RBAC runtime must keep
// resolving each one to its level and permission set, and each English alias must resolve identically.
// The modules are loaded inside the test (not at import time) so that a broken legacy mapping (which makes
// rbac.service throw while it builds the alias matrix) fails as an assertion instead of as a suite crash.
describe('RBAC runtime keeps resolving the legacy role slugs (same level and permissions as the canonical alias)', () => {
  type RbacModule = typeof import('../../core/rbac/rbac.service');
  type HierarchyModule = typeof import('../../core/rbac/role-hierarchy');
  const load = (): { rbac: RbacModule; hierarchy: HierarchyModule } => {
    let out: { rbac: RbacModule; hierarchy: HierarchyModule } | undefined;
    jest.isolateModules(() => {
      out = {
        rbac: require('../../core/rbac/rbac.service') as RbacModule,
        hierarchy: require('../../core/rbac/role-hierarchy') as HierarchyModule,
      };
    });
    return out!;
  };

  const expected: Array<[legacy: string, canonical: string, level: number, grantedKey: string]> = [
    ['artista', 'artist', 30, 'artist:read'],
    ['colaborador', 'collaborator', 20, 'catalog:read'],
    ['comercial', 'sales', 45, 'crm:create'],
    ['juridico', 'legal', 55, 'contracts:create'],
    ['produtor', 'producer', 40, 'catalog:create'],
    ['rh_manager', 'hr_manager', 55, 'rh:create'],
  ];

  it('loading the RBAC runtime does not throw', () => {
    expect(() => load()).not.toThrow();
  });

  it.each(expected)('%s keeps its own hierarchy level and permissions; %s resolves to the same', (legacy, canonical, level, grantedKey) => {
    const { rbac } = load();
    const service = new rbac.RbacService({ resolve: jest.fn() } as never);
    expect(rbac.ROLE_HIERARCHY[legacy]).toBe(level);
    expect(service.getHierarchyLevel(legacy)).toBe(level);
    expect(service.getHierarchyLevel(canonical)).toBe(level);
    expect(service.getPermissions(legacy)).toContain(grantedKey);
    expect(service.getPermissions(legacy).length).toBeGreaterThan(0);
    expect(service.getPermissions(canonical)).toEqual(service.getPermissions(legacy));
    expect(rbac.ROLE_PERMISSIONS[legacy]).toBeDefined();
  });

  it('English aliases map onto exactly the legacy slugs persisted in the database', () => {
    const { hierarchy } = load();
    // artist/artista is a separate persisted row (artist is not an alias), every other pair is an alias
    for (const [legacy, canonical] of expected.filter(([l]) => l !== 'artista')) {
      expect(hierarchy.ENGLISH_ROLE_ALIASES[canonical]).toBe(legacy);
    }
  });

  it('unrelated roles are not widened by the legacy handling', () => {
    const { rbac } = load();
    const service = new rbac.RbacService({ resolve: jest.fn() } as never);
    expect(service.getPermissions('viewer')).not.toContain('contracts:create');
    expect(service.getHierarchyLevel('not_a_role')).toBe(0);
  });
});

// Persisted permission rows and the seed matrix still spell the HR module `rh:*`; the runtime accepts both spellings
// (a grant of rh:x is a grant of hr:x and vice versa, same action only). Each legacy `rh:` namespace site must be pinned.
describe('RBAC hr/rh permission namespace aliases (legacy rh:* grants stay valid)', () => {
  type RbacModule = typeof import('../../core/rbac/rbac.service');
  const load = (): RbacModule => {
    let out: RbacModule | undefined;
    jest.isolateModules(() => {
      out = require('../../core/rbac/rbac.service') as RbacModule;
    });
    return out!;
  };
  const actions = ['read', 'create', 'update', 'delete'] as const;

  it.each(actions)('a legacy rh:%s grant also grants hr:%s and nothing wider', (action) => {
    const { expandHrPermissionAliases } = load();
    const out = expandHrPermissionAliases([`rh:${action}`]);
    expect([...out].sort()).toEqual([`hr:${action}`, `rh:${action}`].sort());
  });

  it.each(actions)('a canonical hr:%s grant also reads as the legacy rh:%s and nothing wider', (action) => {
    const { expandHrPermissionAliases } = load();
    const out = expandHrPermissionAliases([`hr:${action}`]);
    expect([...out].sort()).toEqual([`hr:${action}`, `rh:${action}`].sort());
  });

  it('keys outside the hr/rh namespace are passed through untouched', () => {
    const { expandHrPermissionAliases } = load();
    expect(expandHrPermissionAliases(['artist:read', 'rhythm:read'])).toEqual(['artist:read', 'rhythm:read']);
  });

  it('the legacy seed matrix grants the full rh:* set to super_admin and to the rh_manager slug, each action explicitly', () => {
    const { ROLE_PERMISSIONS } = load();
    for (const role of [SystemRole.SUPER_ADMIN, FunctionalRole.RH_MANAGER]) {
      for (const action of actions) {
        expect(ROLE_PERMISSIONS[role]).toContain(`rh:${action}`);
      }
    }
    expect(ROLE_PERMISSIONS[FunctionalRole.COLABORADOR]).not.toContain('rh:read');
  });
});
