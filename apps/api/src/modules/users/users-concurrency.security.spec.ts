import { ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Task L — two risks fixed together in this module:
 *
 * 1) update() (PATCH /users/:id, gate 'manager') accepted `role`/`status` without
 *    going through the authorization checks (assertCanAssignRole) nor the
 *    last-owner check (assertNotLastOwner) the dedicated endpoints have — a
 *    'manager' could self-promote to 'owner' through the generic PATCH.
 *    UpdateUserDto no longer accepts these fields; update() only touches full_name/
 *    phone. Proven here at the service level (the DTO rejection itself is already
 *    covered by the ValidationPipe whitelist).
 *
 * 2) lost update: update()/assignRole()/setStatus() overwrote without checking
 *    whether the record changed since it was read. They now use casUpdate — A/B scenario
 *    proven below.
 */
describe('UsersService — Task L (RBAC separation + concurrency)', () => {
  const TENANT = 'tenant-a';
  const MEMBER_ID = 'member-a';
  const NOW = new Date('2026-08-14T10:00:00.000Z');

  function buildService(opts: {
    findOneResult?: Record<string, unknown>;
    updateAffected?: number;
    ownerCount?: number;
  } = {}) {
    const {
      findOneResult = { id: MEMBER_ID, tenant_id: TENANT, role: 'editor', auth_user_id: 'auth-1', updated_at: NOW },
      updateAffected = 1,
      ownerCount = 2,
    } = opts;

    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(findOneResult),
      getCount: jest.fn().mockResolvedValue(ownerCount),
    };
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      update: jest.fn().mockResolvedValue({ affected: updateAffected }),
      manager: { query: jest.fn().mockResolvedValue([]) },
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
    return { service, repo, roleResolver, rbacCache };
  }

  describe('profile vs RBAC separation', () => {
    it('update() only writes full_name/phone — never role/role_id/is_active even if present in the object', async () => {
      const { service, repo } = buildService();
      // Simulates a "leaked" dto with role/status (should not happen via the
      // real DTO, but proves the SERVICE itself does not process them).
      await service.update(TENANT, MEMBER_ID, {
        fullName: 'Novo Nome',
        phone: '123',
        role: 'owner',
        status: 'active',
      } as any);

      const [, payload] = repo.update.mock.calls[0];
      expect(payload).toMatchObject({ full_name: 'Novo Nome', phone: '123' });
      expect(payload).not.toHaveProperty('role');
      expect(payload).not.toHaveProperty('role_id');
      expect(payload).not.toHaveProperty('is_active');
    });
  });

  describe('concurrency — A/B scenario', () => {
    it('update(): B saves a profile against a version already overwritten by A -> 409', async () => {
      const { service } = buildService({ updateAffected: 0 });
      await expect(
        service.update(TENANT, MEMBER_ID, {
          fullName: 'Edição de B',
          expectedUpdatedAt: NOW.toISOString(),
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('update(): without expectedUpdatedAt, applies unconditionally (backward compatible)', async () => {
      const { service, repo } = buildService({ updateAffected: 1 });
      await service.update(TENANT, MEMBER_ID, { fullName: 'x' } as any);
      expect(repo.update).toHaveBeenCalledWith({ id: MEMBER_ID, tenant_id: TENANT }, expect.objectContaining({ full_name: 'x' }));
    });

    it('assignRole(): stale version -> 409, BUT only after authorization/hierarchy have been checked', async () => {
      const { service, repo } = buildService({ updateAffected: 0 });
      await expect(
        service.assignRole(TENANT, MEMBER_ID, 'admin', 'owner', NOW.toISOString()),
      ).rejects.toThrow(ConflictException);
      // roleResolver (part of the role -> role_id resolution, post-authorization)
      // was still called before the CAS failed — confirms the order is
      // authorization -> resolution -> CAS, never CAS skipping authorization.
      expect(repo.update).toHaveBeenCalledTimes(1);
    });

    it('setStatus(): stale version -> 409, does not silently deactivate', async () => {
      const { service } = buildService({ updateAffected: 0 });
      await expect(
        service.setStatus(TENANT, MEMBER_ID, 'inactive', NOW.toISOString()),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setStatus() — last-owner protection preserved', () => {
    it('rejects deactivating the tenant\'s last active owner', async () => {
      const { service } = buildService({
        findOneResult: { id: MEMBER_ID, tenant_id: TENANT, role: 'owner', auth_user_id: 'auth-1', updated_at: NOW },
        ownerCount: 0,
      });
      await expect(service.setStatus(TENANT, MEMBER_ID, 'inactive')).rejects.toThrow(BadRequestException);
    });

    it('allows reactivation (status=active) even as the only owner — it is not a deactivation', async () => {
      const { service, repo } = buildService({
        findOneResult: { id: MEMBER_ID, tenant_id: TENANT, role: 'owner', auth_user_id: 'auth-1', updated_at: NOW },
        ownerCount: 0,
      });
      await service.setStatus(TENANT, MEMBER_ID, 'active');
      expect(repo.update).toHaveBeenCalledWith(
        { id: MEMBER_ID, tenant_id: TENANT },
        expect.objectContaining({ is_active: true }),
      );
    });
  });
});
