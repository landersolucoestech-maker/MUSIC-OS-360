import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * find-5cc269d3: a tenant `owner` could self-promote (or promote any member
 * of their own tenant) directly to the global `super_admin` role via
 * PATCH /users/:id/role. assertCanAssignRole's hierarchy ceiling is
 * intentionally bypassed for owner/tenant_owner/super_admin actors, but it
 * never checked `roles.is_assignable` — the same flag invite() already
 * filters on (`AND "is_assignable" = true`) — so the ceiling bypass doubled
 * as an assignability bypass. super_admin is a global, non-tenant-scoped
 * platform role (`is_assignable = false`), and once assigned it grants every
 * `@RequireRole('super_admin')` route platform-wide, including cross-tenant
 * billing admin actions.
 */
describe('UsersService.assertCanAssignRole — is_assignable is authoritative', () => {
  function makeService(roleRows: Array<{ slug: string; hierarchy_level: number; is_assignable: boolean | null }>) {
    const repository = { manager: { query: jest.fn().mockResolvedValue(roleRows) } };
    const dataSource = { getRepository: jest.fn().mockReturnValue(repository) };
    return new UsersService(
      dataSource as never,
      { emitTyped: jest.fn() } as never,
      {} as never,
      { delete: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('rejects an owner assigning the non-assignable super_admin role to a member of their own tenant', async () => {
    const service = makeService([
      { slug: 'owner', hierarchy_level: 90, is_assignable: true },
      { slug: 'super_admin', hierarchy_level: 100, is_assignable: false },
    ]);

    await expect(
      service['assertCanAssignRole']('tenant-a', 'owner', 'super_admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a super_admin actor re-assigning a non-assignable role (bypass must not extend past the hierarchy ceiling)', async () => {
    const service = makeService([
      { slug: 'super_admin', hierarchy_level: 100, is_assignable: false },
    ]);

    await expect(
      service['assertCanAssignRole']('tenant-a', 'super_admin', 'super_admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still allows an owner assigning an ordinary assignable role to a member', async () => {
    const service = makeService([
      { slug: 'owner', hierarchy_level: 90, is_assignable: true },
      { slug: 'admin', hierarchy_level: 80, is_assignable: true },
    ]);

    await expect(
      service['assertCanAssignRole']('tenant-a', 'owner', 'admin'),
    ).resolves.toBeUndefined();
  });
});
