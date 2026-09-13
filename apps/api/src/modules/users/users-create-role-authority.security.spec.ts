import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * find-f7bfdd94 (Wave 4 cross-review): POST /users (create()) wrote dto.role
 * straight into org_members.role/role_id without ever calling
 * assertCanAssignRole — the exact same privilege-escalation class as
 * find-5cc269d3 (PATCH /users/:id/role), reachable through a sibling
 * @RequireRole('owner') endpoint that was not covered by that fix's tests.
 */
describe('UsersService.create — role authority is enforced (find-f7bfdd94)', () => {
  function buildService(roleRows: Array<{ slug: string; hierarchy_level: number; is_assignable: boolean | null }>) {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn()
        .mockResolvedValueOnce(null) // findByUserId: no existing member
        .mockResolvedValueOnce({ org_id: 'org-a' }), // anyMember lookup
    };
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      manager: { query: jest.fn().mockResolvedValue(roleRows) },
      create: jest.fn((v: unknown) => v),
      save: jest.fn().mockResolvedValue({ id: 'member-1' }),
    };
    const dataSource = { getRepository: jest.fn().mockReturnValue(repo) };
    const roleResolver = { resolveOrThrow: jest.fn().mockResolvedValue('role-id-1') };
    const rbacCache = { delete: jest.fn() };

    const service = new UsersService(
      dataSource as never,
      { emitTyped: jest.fn() } as never,
      roleResolver as never,
      rbacCache as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, roleResolver };
  }

  it('rejects an owner creating a member with the non-assignable super_admin role', async () => {
    const { service, roleResolver } = buildService([
      { slug: 'owner', hierarchy_level: 90, is_assignable: true },
      { slug: 'super_admin', hierarchy_level: 100, is_assignable: false },
    ]);

    await expect(
      service.create('tenant-a', { userId: 'u1', email: 'a@b.com', role: 'super_admin' } as never, 'inviter-1', 'owner'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(roleResolver.resolveOrThrow).not.toHaveBeenCalled();
  });

  it('allows an owner creating a member with an ordinary assignable role', async () => {
    const { service } = buildService([
      { slug: 'owner', hierarchy_level: 90, is_assignable: true },
      { slug: 'admin', hierarchy_level: 80, is_assignable: true },
    ]);

    await expect(
      service.create('tenant-a', { userId: 'u1', email: 'a@b.com', role: 'admin' } as never, 'inviter-1', 'owner'),
    ).resolves.toEqual(expect.objectContaining({ id: 'member-1' }));
  });
});
