import { ForbiddenException } from '@nestjs/common';
import { RbacAdminService } from './rbac-admin.service';
import { UsersService } from './users.service';

/**
 * find-986186c1 / find-4d418e9c: a tenant admin could create a
 * tenant-scoped role whose slug collides with a GLOBAL role (e.g.
 * 'super_admin'), with is_assignable=true. UsersService.assertCanAssignRole
 * looked up both the global and tenant-scoped rows for that slug and, due
 * to ORDER BY ("tenant_id" = $2) DESC, let the tenant-scoped row's
 * is_assignable=true shadow the global row's is_assignable=false --
 * bypassing find-5cc269d3's gate entirely and letting the attacker
 * self-assign the literal string 'super_admin' into org_members.role.
 * RolesGuard and the RLS app_is_super_admin() function both trust that
 * string directly, granting full cross-tenant platform access.
 *
 * Two-layer fix:
 *  1. RbacAdminService.assertSlugNotReserved blocks creating/duplicating a
 *     role whose slug already exists as a GLOBAL role.
 *  2. UsersService.assertCanAssignRole's query now orders global rows
 *     first (ORDER BY ("tenant_id" IS NULL) DESC), so even a pre-existing
 *     shadow row can never override the global role's authoritative
 *     is_assignable/hierarchy_level.
 */
describe('RBAC reserved-slug collision (find-986186c1)', () => {
  describe('RbacAdminService.createRole / duplicateRole — creation-time guard', () => {
    const mutations = { grantRolePermission: jest.fn(), createRole: jest.fn() };

    beforeEach(() => jest.clearAllMocks());

    it('rejects creating a tenant role whose slug collides with an existing global role', async () => {
      const ds = { query: jest.fn().mockResolvedValueOnce([{ 1: 1 }]) }; // global 'super_admin' row exists
      const service = new RbacAdminService(ds as never, mutations as never);

      await expect(
        service.createRole('tenant-a', 'user-a', 'owner', { name: 'Fake Admin', slug: 'super_admin' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mutations.createRole).not.toHaveBeenCalled();
    });

    it('still allows creating a role whose slug does not collide with any global role', async () => {
      const ds = { query: jest.fn().mockResolvedValueOnce([]) }; // no global row for this slug
      mutations.createRole.mockResolvedValueOnce({ id: 'role-x' });
      const service = new RbacAdminService(ds as never, mutations as never);
      jest.spyOn(service, 'listRoles').mockResolvedValueOnce([{ id: 'role-x' }] as never);

      await expect(
        service.createRole('tenant-a', 'user-a', 'owner', { name: 'Regional Manager', slug: 'regional_manager' } as never),
      ).resolves.toEqual({ id: 'role-x' });
      expect(mutations.createRole).toHaveBeenCalled();
    });

    it('rejects duplicating a role into a slug that collides with a global role', async () => {
      const ds = {
        query: jest.fn()
          .mockResolvedValueOnce([{ hierarchy_level: 10, description: null }]) // getRoleRow(source)
          .mockResolvedValueOnce([{ 1: 1 }]), // global 'admin' row exists
      };
      const service = new RbacAdminService(ds as never, mutations as never);

      await expect(
        service.duplicateRole('tenant-a', 'user-a', 'owner', 'role-a', { name: 'Copy', slug: 'admin' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mutations.createRole).not.toHaveBeenCalled();
    });
  });

  describe('UsersService.assertCanAssignRole — global role rows are always authoritative', () => {
    function makeService(roleRows: Array<{ slug: string; hierarchy_level: number; is_assignable: boolean | null }>) {
      const query = jest.fn().mockResolvedValue(roleRows);
      const repository = { manager: { query } };
      const dataSource = { getRepository: jest.fn().mockReturnValue(repository) };
      const service = new UsersService(
        dataSource as never,
        { emitTyped: jest.fn() } as never,
        {} as never,
        { delete: jest.fn() } as never,
        {} as never,
        {} as never,
        {} as never,
      );
      return { service, query };
    }

    it('orders global (tenant_id IS NULL) rows first in the slug-resolution query', async () => {
      const { service, query } = makeService([
        { slug: 'owner', hierarchy_level: 90, is_assignable: true },
        { slug: 'admin', hierarchy_level: 80, is_assignable: true },
      ]);
      await service['assertCanAssignRole']('tenant-a', 'owner', 'admin');
      const [sql] = query.mock.calls[0];
      expect(sql).toContain('ORDER BY ("tenant_id" IS NULL) DESC');
    });

    it('rejects an attacker-shadowed super_admin assignment even when a tenant-scoped duplicate row is present, because the global row resolves first', async () => {
      // Reflects the corrected query order: Postgres now returns the global
      // row before the tenant-scoped shadow row for the same slug.
      const { service } = makeService([
        { slug: 'owner', hierarchy_level: 90, is_assignable: true },
        { slug: 'super_admin', hierarchy_level: 100, is_assignable: false }, // global -- authoritative
        { slug: 'super_admin', hierarchy_level: 50, is_assignable: true }, // attacker's tenant-scoped shadow row
      ]);

      await expect(
        service['assertCanAssignRole']('tenant-a', 'owner', 'super_admin'),
      ).rejects.toThrow(/não pode ser atribuído/);
    });

    it('still allows an ordinary, non-colliding assignable role', async () => {
      const { service } = makeService([
        { slug: 'owner', hierarchy_level: 90, is_assignable: true },
        { slug: 'admin', hierarchy_level: 80, is_assignable: true },
      ]);

      await expect(
        service['assertCanAssignRole']('tenant-a', 'owner', 'admin'),
      ).resolves.toBeUndefined();
    });
  });
});
