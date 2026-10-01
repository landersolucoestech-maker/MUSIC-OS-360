import { RbacService, ROLE_PERMISSIONS, expandHrPermissionAliases } from './rbac.service';
import { FunctionalRole } from '@music-os-360/types';

describe('RBAC hr/rh permission dual-read', () => {
  const resolver = { resolve: jest.fn() };
  const service = new RbacService(resolver as never);

  it('expands each spelling to its twin, same action only', () => {
    expect(expandHrPermissionAliases(['rh:read', 'artist:read']).sort()).toEqual(['artist:read', 'hr:read', 'rh:read']);
    expect(expandHrPermissionAliases(['hr:update'])).toEqual(expect.arrayContaining(['hr:update', 'rh:update']));
    expect(expandHrPermissionAliases(['hr:update'])).not.toContain('rh:read');
    expect(expandHrPermissionAliases(['rhythm:read', 'hrx:read'])).toEqual(['rhythm:read', 'hrx:read']);
  });

  it('seed matrix is unchanged: still persists rh:* and writes no hr:* key', () => {
    const all = Object.values(ROLE_PERMISSIONS).flat();
    expect(all.some((k) => k.startsWith('hr:'))).toBe(false);
    expect(ROLE_PERMISSIONS[FunctionalRole.RH_MANAGER]).toContain('rh:read');
  });

  it('can() accepts hr for roles holding rh and never widens other roles', () => {
    expect(service.can(FunctionalRole.RH_MANAGER, 'hr', 'read')).toBe(true);
    expect(service.can(FunctionalRole.RH_MANAGER, 'rh', 'delete')).toBe(true);
    expect(service.can('viewer', 'hr', 'read')).toBe(false);
    expect(service.can('viewer', 'rh', 'read')).toBe(false);
  });

  it('getEffectivePermissions exposes both spellings from persisted rh rows', async () => {
    resolver.resolve.mockResolvedValueOnce(['rh:read', 'rh:update']);
    const perms = await service.getEffectivePermissions({ role: 'hr_manager' } as never);
    expect(perms).toEqual(expect.arrayContaining(['rh:read', 'hr:read', 'rh:update', 'hr:update']));
    expect(perms).not.toContain('hr:delete');
  });
});
