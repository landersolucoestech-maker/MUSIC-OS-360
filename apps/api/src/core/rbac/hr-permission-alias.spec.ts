import { FunctionalRole } from '@music-os-360/types';

// rbac.service builds its alias matrix at import time and throws when a legacy slug mapping is broken. The module is
// therefore loaded inside each test (never at import time) so that such a defect fails an assertion, not the whole suite.
type RbacModule = typeof import('./rbac.service');
type HierarchyModule = typeof import('./role-hierarchy');
function loadModules(): { mod: RbacModule; hierarchy: HierarchyModule } {
  let mod: RbacModule | undefined;
  let hierarchy: HierarchyModule | undefined;
  jest.isolateModules(() => {
    mod = require('./rbac.service');
    hierarchy = require('./role-hierarchy');
  });
  return { mod: mod!, hierarchy: hierarchy! };
}

describe('RBAC hr/rh permission dual-read', () => {
  const resolver = { resolve: jest.fn() };
  const newService = () => {
    const { mod } = loadModules();
    return { mod, service: new mod.RbacService(resolver as never) };
  };

  it('loading the RBAC runtime does not throw', () => {
    expect(() => loadModules()).not.toThrow();
  });

  it('expands each spelling to its twin, same action only', () => {
    const { expandHrPermissionAliases } = loadModules().mod;
    expect(expandHrPermissionAliases(['rh:read', 'artist:read']).sort()).toEqual(['artist:read', 'hr:read', 'rh:read']);
    expect(expandHrPermissionAliases(['hr:update'])).toEqual(expect.arrayContaining(['hr:update', 'rh:update']));
    expect(expandHrPermissionAliases(['hr:update'])).not.toContain('rh:read');
    expect(expandHrPermissionAliases(['rhythm:read', 'hrx:read'])).toEqual(['rhythm:read', 'hrx:read']);
  });

  it('seed matrix is unchanged: still persists rh:* and writes no hr:* key', () => {
    const { ROLE_PERMISSIONS } = loadModules().mod;
    const all = Object.values(ROLE_PERMISSIONS).flat();
    expect(all.some((k) => k.startsWith('hr:'))).toBe(false);
    expect(ROLE_PERMISSIONS[FunctionalRole.RH_MANAGER]).toContain('rh:read');
  });

  it('can() accepts hr for roles holding rh and never widens other roles', () => {
    const { service } = newService();
    expect(service.can(FunctionalRole.RH_MANAGER, 'hr', 'read')).toBe(true);
    expect(service.can(FunctionalRole.RH_MANAGER, 'rh', 'delete')).toBe(true);
    expect(service.can('viewer', 'hr', 'read')).toBe(false);
    expect(service.can('viewer', 'rh', 'read')).toBe(false);
  });

  it('getEffectivePermissions exposes both spellings from persisted rh rows', async () => {
    const { service } = newService();
    resolver.resolve.mockResolvedValueOnce(['rh:read', 'rh:update']);
    const perms = await service.getEffectivePermissions({ role: 'hr_manager' } as never);
    expect(perms).toEqual(expect.arrayContaining(['rh:read', 'hr:read', 'rh:update', 'hr:update']));
    expect(perms).not.toContain('hr:delete');
  });

  it('rh_manager and its hr_manager alias resolve to the same level and the same rh/hr permissions', () => {
    const { mod, service } = newService();
    const { hierarchy } = loadModules();
    expect(hierarchy.ENGLISH_ROLE_ALIASES['hr_manager']).toBe('rh_manager');
    expect(mod.ROLE_HIERARCHY['rh_manager']).toBe(55);
    expect(service.getHierarchyLevel('rh_manager')).toBe(55);
    expect(service.getHierarchyLevel('hr_manager')).toBe(55);
    expect(service.getPermissions('rh_manager')).toContain('rh:delete');
    expect(service.getPermissions('hr_manager')).toEqual(service.getPermissions('rh_manager'));
    expect(service.can('rh_manager', 'hr', 'delete')).toBe(true);
    expect(service.can('hr_manager', 'hr', 'delete')).toBe(true);
    expect(service.can('hr_manager', 'rh', 'read')).toBe(true);
  });
});
