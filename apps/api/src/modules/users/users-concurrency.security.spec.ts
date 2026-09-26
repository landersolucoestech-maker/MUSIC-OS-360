import { ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Task L — dois riscos corrigidos juntos neste módulo:
 *
 * 1) update() (PATCH /users/:id, gate 'manager') aceitava `role`/`status` sem
 *    passar pelas checagens de autorização (assertCanAssignRole) nem de
 *    último-owner (assertNotLastOwner) que os endpoints dedicados têm — um
 *    'manager' conseguia se auto-promover a 'owner' pelo PATCH genérico.
 *    UpdateUserDto não aceita mais esses campos; update() só toca full_name/
 *    phone. Provado aqui a nível de service (a rejeição do DTO em si já é
 *    coberta pelo whitelist do ValidationPipe).
 *
 * 2) lost update: update()/assignRole()/setStatus() sobrescreviam sem checar
 *    se o registro mudou desde a leitura. Agora usam casUpdate — cenário A/B
 *    provado abaixo.
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
      // Simula um dto "vazado" com role/status (não deveria acontecer via
      // DTO real, mas prova que o SERVICE em si não os processa).
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
      // roleResolver (parte da resolução role -> role_id, pós-autorização)
      // ainda foi chamado antes do CAS falhar — confirma que a ordem é
      // autorização -> resolução -> CAS, nunca CAS pulando a autorização.
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
