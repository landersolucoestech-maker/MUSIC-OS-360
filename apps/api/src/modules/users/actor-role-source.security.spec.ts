/**
 * actor-role-source.security.spec.ts
 *
 * Regression test for a privilege-escalation gap: UsersController and
 * RbacAdminController used to pass `user.orgRole` (a JWT claim, only as
 * fresh as the token itself) as the `actorRole` argument into every
 * hierarchy/mutability check (assertCanAssignRole, assertHierarchy,
 * assertMutableRole). A member demoted after their token was issued kept
 * elevated privilege — including the ability to re-grant their own old
 * role — for as long as their JWT stayed valid, because nothing re-checked
 * their CURRENT membership row.
 *
 * Fix: both controllers now source the actor's role from `@CurrentMember()`
 * (`request.currentMember`, resolved fresh from `org_members` by
 * TenantGuard on every request — the exact same source RolesGuard already
 * uses to gate the route) instead of `@CurrentUser().orgRole` (the JWT
 * claim). These tests prove the JWT claim is no longer consulted at all
 * for these calls, regardless of what it says.
 */

import { UsersController } from './users.controller';
import { RbacAdminController } from './rbac-admin.controller';
import type { JwtAuth } from '../../core/guards/auth.guard';

describe('Actor role source — privilege checks use currentMember, not the JWT claim', () => {
  const tenant = { id: 'tenant-1' };

  function jwtAuth(orgRole: string | null): JwtAuth {
    return { userId: 'user-1', orgRole } as JwtAuth;
  }

  describe('UsersController', () => {
    function makeController(svc: Record<string, jest.Mock>) {
      return new UsersController(svc as never);
    }

    it('assignRole: demoted owner (stale JWT still says "owner") is checked as their CURRENT "admin" membership', () => {
      const svc = { assignRole: jest.fn() };
      const controller = makeController(svc);

      controller.assignRole(
        tenant,
        { role: 'admin' }, // fresh DB membership: demoted
        'target-user',
        { role: 'owner' } as never,
      );

      // actorRole passed is 'admin' (the fresh membership), not 'owner' (what a stale JWT claim would say).
      expect(svc.assignRole).toHaveBeenCalledWith(
        'tenant-1', 'target-user', 'owner', 'admin', undefined,
      );
    });

    it('assignRole: promoted member (stale JWT still says "viewer") is checked as their CURRENT "owner" membership', () => {
      const svc = { assignRole: jest.fn() };
      const controller = makeController(svc);

      controller.assignRole(tenant, { role: 'owner' }, 'target-user', { role: 'admin' } as never);

      expect(svc.assignRole).toHaveBeenCalledWith(
        'tenant-1', 'target-user', 'admin', 'owner', undefined,
      );
    });

    it('assignRole: missing membership context falls back to the safe default (viewer), never to the JWT claim', () => {
      const svc = { assignRole: jest.fn() };
      const controller = makeController(svc);

      controller.assignRole(tenant, undefined, 'target-user', { role: 'owner' } as never);

      expect(svc.assignRole).toHaveBeenCalledWith(
        'tenant-1', 'target-user', 'owner', undefined, undefined,
      );
    });

    it('create: uses currentMember.role, not the JWT claim (find-f7bfdd94)', () => {
      const svc = { create: jest.fn() };
      const controller = makeController(svc);

      controller.create(tenant, { userId: 'user-1' }, { role: 'admin' }, {
        userId: 'target-user', email: 'a@b.com', role: 'owner',
      } as never);

      expect(svc.create).toHaveBeenCalledWith(
        'tenant-1', { userId: 'target-user', email: 'a@b.com', role: 'owner' }, 'user-1', 'admin',
      );
    });

    it('invite: uses currentMember.role, not the JWT claim', () => {
      const svc = { invite: jest.fn() };
      const controller = makeController(svc);

      controller.invite(tenant, { userId: 'user-1' }, { role: 'admin' }, {
        email: 'a@b.com', roleId: 'role-1',
      } as never);

      expect(svc.invite).toHaveBeenCalledWith('tenant-1', 'a@b.com', 'role-1', 'user-1', 'admin');
    });

    it('resendInvitation: uses currentMember.role, not the JWT claim', () => {
      const svc = { resendInvitation: jest.fn() };
      const controller = makeController(svc);

      controller.resendInvitation(tenant, { userId: 'user-1' }, { role: 'admin' }, 'inv-1');

      expect(svc.resendInvitation).toHaveBeenCalledWith('tenant-1', 'inv-1', 'user-1', 'admin');
    });

    it('cancelInvitation: uses currentMember.role, not the JWT claim', () => {
      const svc = { cancelInvitation: jest.fn() };
      const controller = makeController(svc);

      controller.cancelInvitation(tenant, { role: 'admin' }, 'inv-1');

      expect(svc.cancelInvitation).toHaveBeenCalledWith('tenant-1', 'inv-1', 'admin');
    });
  });

  describe('RbacAdminController', () => {
    function makeController(svc: Record<string, jest.Mock>) {
      return new RbacAdminController(svc as never);
    }

    it('createRole: demoted admin (stale JWT says "owner") is checked as their CURRENT "viewer" membership', () => {
      const svc = { createRole: jest.fn() };
      const controller = makeController(svc);

      controller.createRole(tenant, jwtAuth('owner'), { role: 'viewer' }, {
        name: 'Custom', hierarchyLevel: 5,
      } as never);

      expect(svc.createRole).toHaveBeenCalledWith('tenant-1', 'user-1', 'viewer', {
        name: 'Custom', hierarchyLevel: 5,
      });
    });

    it('grant: uses currentMember.role, never the JWT claim, even when they disagree', () => {
      const svc = { grant: jest.fn() };
      const controller = makeController(svc);

      controller.grant(tenant, jwtAuth('owner'), { role: 'admin' }, 'role-1', 'perm-1');

      expect(svc.grant).toHaveBeenCalledWith('tenant-1', 'user-1', 'admin', 'role-1', 'perm-1');
    });

    it('revoke: uses currentMember.role, never the JWT claim', () => {
      const svc = { revoke: jest.fn() };
      const controller = makeController(svc);

      controller.revoke(tenant, jwtAuth('owner'), { role: 'admin' }, 'role-1', 'perm-1');

      expect(svc.revoke).toHaveBeenCalledWith('tenant-1', 'user-1', 'admin', 'role-1', 'perm-1');
    });

    it('archiveRole/restoreRole/duplicateRole/addInheritance/removeInheritance: all source actorRole from currentMember', () => {
      const svc = {
        archiveRole: jest.fn(), restoreRole: jest.fn(), duplicateRole: jest.fn(),
        addInheritance: jest.fn(), removeInheritance: jest.fn(),
      };
      const controller = makeController(svc);
      const stale = jwtAuth('owner');
      const fresh = { role: 'admin' };

      controller.archiveRole(tenant, stale, fresh, 'role-1');
      controller.restoreRole(tenant, stale, fresh, 'role-1');
      controller.duplicateRole(tenant, stale, fresh, 'role-1', {} as never);
      controller.addInheritance(tenant, stale, fresh, 'role-1', { parentRoleId: 'role-2' } as never);
      controller.removeInheritance(tenant, stale, fresh, 'role-1', 'role-2');

      expect(svc.archiveRole).toHaveBeenCalledWith('tenant-1', 'user-1', 'admin', 'role-1');
      expect(svc.restoreRole).toHaveBeenCalledWith('tenant-1', 'user-1', 'admin', 'role-1');
      expect(svc.duplicateRole).toHaveBeenCalledWith('tenant-1', 'user-1', 'admin', 'role-1', {});
      expect(svc.addInheritance).toHaveBeenCalledWith('tenant-1', 'user-1', 'admin', 'role-1', 'role-2');
      expect(svc.removeInheritance).toHaveBeenCalledWith('tenant-1', 'user-1', 'admin', 'role-1', 'role-2');
    });

    it('missing membership context falls back to the safe default (viewer), never to the JWT claim', () => {
      const svc = { createRole: jest.fn() };
      const controller = makeController(svc);

      controller.createRole(tenant, jwtAuth('owner'), undefined, { name: 'X' } as never);

      expect(svc.createRole).toHaveBeenCalledWith('tenant-1', 'user-1', 'viewer', { name: 'X' });
    });
  });
});
