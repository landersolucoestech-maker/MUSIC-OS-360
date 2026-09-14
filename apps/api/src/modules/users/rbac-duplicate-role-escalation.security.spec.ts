import { ForbiddenException } from '@nestjs/common';
import { RbacAdminService } from './rbac-admin.service';

/**
 * find-e0b57623: found by an independent final-review pass after
 * find-4d418e9c/find-986186c1 (the slug-collision escalation) was already
 * fixed -- a structurally distinct escalation path on the same surface.
 *
 * RbacAdminService.getRoleRow intentionally allows reading a GLOBAL
 * (tenant_id IS NULL) role (e.g. so a tenant can see what a role it was
 * granted inherits from). duplicateRole reused that same read as its
 * SOURCE for cloning -- letting a tenant owner:
 *   1. read the real global 'super_admin' role (hierarchy_level=100,
 *      is_assignable=false) as a duplication source;
 *   2. get a clamped hierarchy_level=89 past assertHierarchy (owner is
 *      hierarchy-exempt);
 *   3. have the clone force-created with isAssignable=true regardless of
 *      the source's real is_assignable=false;
 *   4. have EVERY one of super_admin's grants copied via
 *      grantRolePermission directly, bypassing assertPermission's own
 *      is_assignable gate (the same gate grant() enforces for a single
 *      permission) entirely for the whole batch.
 * The result: a tenant-scoped, self-assignable role holding a
 * non-assignable global role's full permission set -- a real
 * authorization-control bypass on RbacDecisionService-backed
 * @RequirePermission(...) routes, independent of the slug string used.
 */
describe('RbacAdminService.duplicateRole — cannot clone a global role or bypass permission assignability (find-e0b57623)', () => {
  const mutations = { grantRolePermission: jest.fn(), createRole: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('rejects duplicating a GLOBAL role (e.g. super_admin) as a source', async () => {
    const ds = {
      query: jest.fn().mockResolvedValueOnce([{
        id: 'role-super-admin',
        tenant_id: null, // global
        slug: 'super_admin',
        name: 'Super Admin',
        description: null,
        hierarchy_level: 100,
        is_system: true,
        is_assignable: false,
        archived_at: null,
      }]),
    };
    const service = new RbacAdminService(ds as never, mutations as never);

    await expect(
      service.duplicateRole('tenant-a', 'user-a', 'owner', 'role-super-admin', { name: 'Clone' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mutations.createRole).not.toHaveBeenCalled();
    expect(mutations.grantRolePermission).not.toHaveBeenCalled();
  });

  it('respects the source role\'s own is_assignable instead of forcing true', async () => {
    const ds = {
      query: jest.fn()
        .mockResolvedValueOnce([{
          id: 'role-a', tenant_id: 'tenant-a', slug: 'custom', name: 'Custom',
          description: null, hierarchy_level: 10, is_system: false, is_assignable: false, archived_at: null,
        }])
        .mockResolvedValueOnce([]) // assertSlugNotReserved -- no global collision
        .mockResolvedValueOnce([]) // role_permissions for source (no grants)
        .mockResolvedValueOnce([{ id: 'role-a', tenant_id: 'tenant-a', slug: 'clone', name: 'Clone' }]), // getRoleDetail-ish
    };
    mutations.createRole.mockResolvedValueOnce({ id: 'role-clone' });
    const service = new RbacAdminService(ds as never, mutations as never);
    jest.spyOn(service, 'getRoleDetail' as never).mockResolvedValueOnce({ id: 'role-clone' } as never);

    await service.duplicateRole('tenant-a', 'user-a', 'owner', 'role-a', { name: 'Clone' } as never);

    expect(mutations.createRole).toHaveBeenCalledWith(expect.objectContaining({ isAssignable: false }));
  });

  it('skips copying a non-assignable permission grant instead of copying it blindly', async () => {
    const ds = {
      query: jest.fn()
        .mockResolvedValueOnce([{
          id: 'role-a', tenant_id: 'tenant-a', slug: 'custom', name: 'Custom',
          description: null, hierarchy_level: 10, is_system: false, is_assignable: true, archived_at: null,
        }])
        .mockResolvedValueOnce([]) // assertSlugNotReserved
        .mockResolvedValueOnce([{ permission_id: 'perm-reserved' }]) // role_permissions
        .mockResolvedValueOnce([]) // assertPermission(perm-reserved) -- NOT assignable -> throws NotFoundException
        .mockResolvedValueOnce([{ id: 'role-clone' }]), // getRoleDetail-ish
    };
    mutations.createRole.mockResolvedValueOnce({ id: 'role-clone' });
    const service = new RbacAdminService(ds as never, mutations as never);
    jest.spyOn(service, 'getRoleDetail' as never).mockResolvedValueOnce({ id: 'role-clone' } as never);

    await service.duplicateRole('tenant-a', 'user-a', 'owner', 'role-a', { name: 'Clone' } as never);

    expect(mutations.grantRolePermission).not.toHaveBeenCalled();
  });

  it('still copies an assignable permission grant normally', async () => {
    const ds = {
      query: jest.fn()
        .mockResolvedValueOnce([{
          id: 'role-a', tenant_id: 'tenant-a', slug: 'custom', name: 'Custom',
          description: null, hierarchy_level: 10, is_system: false, is_assignable: true, archived_at: null,
        }])
        .mockResolvedValueOnce([]) // assertSlugNotReserved
        .mockResolvedValueOnce([{ permission_id: 'perm-ok' }]) // role_permissions
        .mockResolvedValueOnce([{ 1: 1 }]) // assertPermission(perm-ok) -- assignable, passes
        .mockResolvedValueOnce([{ id: 'role-clone' }]),
    };
    mutations.createRole.mockResolvedValueOnce({ id: 'role-clone' });
    const service = new RbacAdminService(ds as never, mutations as never);
    jest.spyOn(service, 'getRoleDetail' as never).mockResolvedValueOnce({ id: 'role-clone' } as never);

    await service.duplicateRole('tenant-a', 'user-a', 'owner', 'role-a', { name: 'Clone' } as never);

    expect(mutations.grantRolePermission).toHaveBeenCalledWith('role-clone', 'perm-ok', 'tenant-a', 'user-a');
  });
});
