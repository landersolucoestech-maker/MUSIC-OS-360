import { ForbiddenException } from '@nestjs/common';
import { RbacAdminService } from './rbac-admin.service';

/**
 * The ACTOR's level is resolved through roleLevel(): it knows the persisted Portuguese slugs
 * (colaborador 20, rh_manager 55, ...) and returns undefined for unknown / inherited keys.
 * Without it every hierarchy comparison is NaN and FAILS OPEN.
 */
describe('RbacAdminService actor level (roleLevel wiring)', () => {
  function build(sourceRow?: Record<string, unknown>) {
    const mutations = {
      createRole: jest.fn(async () => ({ id: 'role-new' })),
      grantRolePermission: jest.fn(),
      updateRole: jest.fn(async () => true),
    };
    const ds = {
      query: jest.fn(async (sql: string) => {
        if (sourceRow && sql.includes('FROM "roles"') && sql.includes('"hierarchy_level", "is_system"')) return [sourceRow];
        return [];
      }),
    };
    const service = new RbacAdminService(ds as never, mutations as never);
    jest.spyOn(service, 'getRoleDetail' as never).mockResolvedValue({ id: 'role-new' } as never);
    return { service, mutations };
  }
  const NAME = { name: 'Custom Role' };

  describe('createRole default level = actor level - 10', () => {
    it.each([
      ['colaborador', 10],
      ['rh_manager', 45],
      ['manager', 60],
      ['admin', 70],
      ['owner', 80],
      ['constructor', 0],
      ['unknown_actor', 0],
    ])('actor %s creates the role at level %d', async (actor, expected) => {
      const { service, mutations } = build();
      await service.createRole('t1', 'u1', actor, { ...NAME } as never).catch((e) => {
        if (!(e instanceof ForbiddenException)) throw e;
      });
      // level 0 for unknown actors: 0 >= 0 is denied, so nothing is created
      if (expected === 0) {
        expect(mutations.createRole).not.toHaveBeenCalled();
        return;
      }
      expect(mutations.createRole).toHaveBeenCalledWith(expect.objectContaining({ hierarchyLevel: expected }));
    });
  });

  describe('assertHierarchy via createRole with an explicit level', () => {
    it.each([
      ['colaborador', 20],
      ['colaborador', 55],
      ['rh_manager', 55],
      ['rh_manager', 80],
      ['artista', 30],
      ['viewer', 10],
      ['constructor', 0],
      ['constructor', 50],
      ['__proto__', 1],
      ['unknown_actor', 0],
      ['unknown_actor', 89],
    ])('actor %s cannot create a role at level %d', async (actor, level) => {
      const { service, mutations } = build();
      await expect(service.createRole('t1', 'u1', actor, { ...NAME, hierarchyLevel: level } as never)).rejects.toBeInstanceOf(ForbiddenException);
      expect(mutations.createRole).not.toHaveBeenCalled();
    });

    it.each([
      ['colaborador', 19],
      ['rh_manager', 54],
      ['manager', 69],
      ['admin', 79],
    ])('actor %s can create a role strictly below its own level (%d)', async (actor, level) => {
      const { service, mutations } = build();
      await service.createRole('t1', 'u1', actor, { ...NAME, hierarchyLevel: level } as never);
      expect(mutations.createRole).toHaveBeenCalledWith(expect.objectContaining({ hierarchyLevel: level }));
    });

    it('owner-class actors are exempt from the own-level rule but never reach the owner level', async () => {
      const { service, mutations } = build();
      await service.createRole('t1', 'u1', 'owner', { ...NAME, hierarchyLevel: 89 } as never);
      expect(mutations.createRole).toHaveBeenCalledWith(expect.objectContaining({ hierarchyLevel: 89 }));
      mutations.createRole.mockClear();
      await expect(service.createRole('t1', 'u1', 'owner', { ...NAME, hierarchyLevel: 90 } as never)).rejects.toBeInstanceOf(ForbiddenException);
      expect(mutations.createRole).not.toHaveBeenCalled();
    });
  });

  describe('updateRole (assertMutableRole -> assertHierarchy)', () => {
    const row = (level: number) => ({
      id: 'r1', tenant_id: 't1', slug: 'custom', name: 'C', description: null,
      hierarchy_level: level, is_system: false, is_assignable: true, archived_at: null,
    });

    it.each([
      ['colaborador', 20],
      ['colaborador', 80],
      ['rh_manager', 55],
      ['constructor', 5],
    ])('actor %s cannot modify a role at level %d', async (actor, level) => {
      const { service, mutations } = build(row(level));
      await expect(service.updateRole('t1', 'u1', actor, 'r1', { name: 'X' } as never)).rejects.toBeInstanceOf(ForbiddenException);
      expect(mutations.updateRole).not.toHaveBeenCalled();
    });

    it('actor rh_manager can modify a role below its level', async () => {
      const { service, mutations } = build(row(54));
      await service.updateRole('t1', 'u1', 'rh_manager', 'r1', { name: 'X' } as never);
      expect(mutations.updateRole).toHaveBeenCalled();
    });
  });

  describe('duplicateRole ceiling = min(source level, actor level - 1)', () => {
    const row = (level: number) => ({
      id: 'r1', tenant_id: 't1', slug: 'custom', name: 'C', description: null,
      hierarchy_level: level, is_system: false, is_assignable: true, archived_at: null,
    });

    it.each([
      ['colaborador', 50, 19],
      ['rh_manager', 80, 54],
      ['manager', 80, 69],
      ['rh_manager', 10, 10],
    ])('actor %s duplicating a level-%d role gets level %d', async (actor, sourceLevel, expected) => {
      const { service, mutations } = build(row(sourceLevel));
      await service.duplicateRole('t1', 'u1', actor, 'r1', { name: 'Clone' } as never);
      expect(mutations.createRole).toHaveBeenCalledWith(expect.objectContaining({ hierarchyLevel: expected }));
    });

    it.each(['constructor', 'unknown_actor'])('unknown actor %s can never duplicate (level 0 is not below level 0)', async (actor) => {
      const { service, mutations } = build(row(50));
      await expect(service.duplicateRole('t1', 'u1', actor, 'r1', { name: 'Clone' } as never)).rejects.toBeInstanceOf(ForbiddenException);
      expect(mutations.createRole).not.toHaveBeenCalled();
    });
  });
});
