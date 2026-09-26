import 'reflect-metadata';

// auth.guard (transitively imported via IS_PUBLIC_KEY) pulls in jwks-rsa→jose (ESM).
// We mock jwks-rsa so jest does not try to transpile the ESM package — same pattern as auth.guard.spec.
jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY, RequirePermission } from '../decorators/permissions.decorator';
import { ROLES_KEY, RequireRole } from '../decorators/roles.decorator';
import type { RbacDecisionService } from '../rbac/rbac-decision.service';

const HANDLER = function handler(): void {};
class KLASS {}

function makeReflector(required: string[]): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(false), // non-public route
    get: jest.fn((key: string, target: unknown) => {
      if (key === PERMISSIONS_KEY) return target === HANDLER ? required : [];
      return undefined;
    }),
  } as unknown as Reflector;
}

function makeContext(member: Record<string, unknown> | undefined): ExecutionContext {
  const req = { method: 'GET', url: '/artists', originalUrl: '/artists', currentMember: member };
  return {
    getHandler: () => HANDLER,
    getClass: () => KLASS,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeDecisions(perms: string[] | Error): RbacDecisionService {
  return {
    evaluate: jest.fn(
      async ({
        requiredPermissions,
      }: {
        requiredPermissions: string[];
      }) => {
        if (perms instanceof Error) throw perms;
        return requiredPermissions.every((permission) =>
          perms.includes(permission),
        )
          ? 'ALLOW'
          : 'DENY';
      },
    ),
  } as unknown as RbacDecisionService;
}

function makeGuard(required: string[], rbacPerms: string[] | Error): PermissionsGuard {
  return new PermissionsGuard(
    makeReflector(required),
    makeDecisions(rbacPerms),
  );
}

const MEMBER = { role: 'editor', role_id: 'r-1', tenant_id: 't-1' };

afterEach(() => {
  delete process.env['RBAC_PERSISTED_AUTHORITY'];
  jest.restoreAllMocks();
});

function enforcementOn(): void {
  process.env['RBAC_PERSISTED_AUTHORITY'] = 'ON';
}

// ── Enforcement OFF (observation mode) ────────────────────────────────────────
describe('PermissionsGuard — enforcement OFF (default)', () => {
  it('does not block even without the permission (only observes/logs)', async () => {
    const guard = makeGuard(['artist:read'], []); // member without permissions
    await expect(guard.canActivate(makeContext(MEMBER))).resolves.toBe(true);
  });

  it('route without @RequirePermission is a no-op (does not call the resolver)', async () => {
    const decisions = makeDecisions([]);
    const guard = new PermissionsGuard(makeReflector([]), decisions);
    await expect(guard.canActivate(makeContext(MEMBER))).resolves.toBe(true);
    expect((decisions.evaluate as jest.Mock)).not.toHaveBeenCalled();
  });
});

// ── Enforcement ON ────────────────────────────────────────────────────────────
describe('PermissionsGuard — enforcement ON', () => {
  beforeEach(enforcementOn);

  it('user with artist:read can access GET', async () => {
    await expect(makeGuard(['artist:read'], ['artist:read']).canActivate(makeContext(MEMBER))).resolves.toBe(true);
  });

  it('user without artist:read receives 403', async () => {
    await expect(makeGuard(['artist:read'], ['catalog:read']).canActivate(makeContext(MEMBER)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('user with artist:create can access POST', async () => {
    await expect(makeGuard(['artist:create'], ['artist:create']).canActivate(makeContext(MEMBER))).resolves.toBe(true);
  });

  it('user with only artist:read CANNOT POST (artist:create)', async () => {
    await expect(makeGuard(['artist:create'], ['artist:read']).canActivate(makeContext(MEMBER)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('user with artist:update can access PATCH', async () => {
    await expect(makeGuard(['artist:update'], ['artist:update']).canActivate(makeContext(MEMBER))).resolves.toBe(true);
  });

  it('user with artist:delete can access DELETE', async () => {
    await expect(makeGuard(['artist:delete'], ['artist:delete']).canActivate(makeContext(MEMBER))).resolves.toBe(true);
  });

  it('multiple permissions (AND): missing one → 403', async () => {
    await expect(makeGuard(['artist:read', 'artist:export'], ['artist:read']).canActivate(makeContext(MEMBER)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('multiple permissions (AND): has all of them → allows', async () => {
    await expect(
      makeGuard(['artist:read', 'artist:export'], ['artist:read', 'artist:export']).canActivate(makeContext(MEMBER)),
    ).resolves.toBe(true);
  });

  it('missing role_id → uses legacy fallback (resolver returns legacy permissions)', async () => {
    const guard = makeGuard(['artist:read'], ['artist:read']); // resolver already encapsulates the fallback (FASE 5)
    await expect(guard.canActivate(makeContext({ role: 'viewer', role_id: null, tenant_id: 't-1' }))).resolves.toBe(true);
  });

  it('custom role from the correct tenant works (resolver returns the permission)', async () => {
    await expect(makeGuard(['artist:read'], ['artist:read']).canActivate(makeContext(MEMBER))).resolves.toBe(true);
  });

  it('custom role from another tenant does NOT work (resolver returns empty → 403)', async () => {
    await expect(makeGuard(['artist:read'], []).canActivate(makeContext(MEMBER)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolver error results in DENY, not allow', async () => {
    await expect(makeGuard(['artist:read'], new Error('db down')).canActivate(makeContext(MEMBER)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no member in context → DENY', async () => {
    await expect(makeGuard(['artist:read'], ['artist:read']).canActivate(makeContext(undefined)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('empty permissions do not grant access', async () => {
    await expect(makeGuard(['artist:read'], []).canActivate(makeContext(MEMBER)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── Parity / coexistence @RequireRole + @RequirePermission ────────────────────
describe('Coexistence @RequireRole + @RequirePermission (pilot parity)', () => {
  class PilotoArtistsController {
    @RequireRole('viewer')
    @RequirePermission('artist:read')
    list(): void {}

    @RequireRole('editor')
    @RequirePermission('artist:create')
    create(): void {}

    @RequireRole('manager')
    @RequirePermission('artist:delete')
    remove(): void {}
  }
  const proto = PilotoArtistsController.prototype;

  it('each route carries BOTH metadata sets (role + permission)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, proto.list)).toEqual(['viewer']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, proto.list)).toEqual(['artist:read']);
    expect(Reflect.getMetadata(ROLES_KEY, proto.create)).toEqual(['editor']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, proto.create)).toEqual(['artist:create']);
    expect(Reflect.getMetadata(ROLES_KEY, proto.remove)).toEqual(['manager']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, proto.remove)).toEqual(['artist:delete']);
  });
});

// ── Key format validation ──────────────────────────────────────────────────────
describe('@RequirePermission — resource:action format', () => {
  it('rejects a malformed key at decoration time', () => {
    expect(() => RequirePermission('ArtistRead')).toThrow(/resource:action/);
    expect(() => RequirePermission('artist:')).toThrow();
  });
  it('accepts a valid key', () => {
    expect(() => RequirePermission('artist:read')).not.toThrow();
  });
});
