import 'reflect-metadata';

jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RbacDecisionService } from '../rbac/rbac-decision.service';
import { RolesGuard } from './roles.guard';

/**
 * CHARACTERIZATION (RBAC slice S0): pins RolesGuard decisions TODAY.
 * Member level = ROLE_HIERARCHY[member.role] ?? 0 ; required level = min over declared roles
 * (unknown required role -> 99) ; class and handler requirements are ANDed (max of the two).
 */
const ROLE_LEVELS: Record<string, number> = {
  super_admin: 100, tenant_owner: 90, owner: 90, admin: 80, manager: 70, editor: 60,
  financial: 60, accounting: 60, juridico: 55, marketing_manager: 55, rh_manager: 55,
  marketing: 50, comercial: 45, produtor: 40, radio: 40, tv: 40, artist: 30, artista: 30,
  colaborador: 20, viewer: 10,
};
const REQUIRED_LEVELS: Record<string, number> = {
  viewer: 10, editor: 60, financial: 60, manager: 70, admin: 80, owner: 90, super_admin: 100,
};

const HANDLER = function handler(): void {};
class Controller {}

function build(opts: {
  method?: string;
  memberRole?: string | undefined;
  hasMember?: boolean;
  handlerRoles?: string[];
  classRoles?: string[];
}) {
  const request: Record<string, unknown> = {
    method: opts.method ?? 'GET',
    url: '/things/1',
    currentMember: opts.hasMember === false ? undefined : { id: 'm', tenant_id: 't', role: opts.memberRole },
  };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
    get: jest.fn((key: string, target: unknown) => {
      if (key !== ROLES_KEY) return undefined;
      return target === HANDLER ? opts.handlerRoles : opts.classRoles;
    }),
  } as unknown as Reflector;
  const decisions = { evaluate: jest.fn().mockResolvedValue('DENY') } as unknown as RbacDecisionService;
  const context = {
    getHandler: () => HANDLER,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector, decisions), context, request };
}

async function decide(opts: Parameters<typeof build>[0]): Promise<'ALLOW' | 'DENY'> {
  const { guard, context } = build(opts);
  try {
    return (await guard.canActivate(context)) === true ? 'ALLOW' : 'DENY';
  } catch (err) {
    if (err instanceof ForbiddenException) return 'DENY';
    throw err;
  }
}

describe('RolesGuard characterization: member role x required role', () => {
  const cases = Object.entries(ROLE_LEVELS).flatMap(([member, memberLevel]) =>
    Object.entries(REQUIRED_LEVELS).map(
      ([required, requiredLevel]) => [member, required, memberLevel >= requiredLevel ? 'ALLOW' : 'DENY'] as const,
    ),
  );

  it.each(cases)('member %s vs @RequireRole(%s) -> %s', async (member, required, expected) => {
    expect(await decide({ memberRole: member, handlerRoles: [required] })).toBe(expected);
  });

  it('matches on level, not on slug: financial (60) passes editor and financial, fails manager', async () => {
    expect(await decide({ memberRole: 'financial', handlerRoles: ['editor'] })).toBe('ALLOW');
    expect(await decide({ memberRole: 'financial', handlerRoles: ['financial'] })).toBe('ALLOW');
    expect(await decide({ memberRole: 'financial', handlerRoles: ['manager'] })).toBe('DENY');
  });

  it('alias parity: artista == artist and tenant_owner == owner for every required level', async () => {
    for (const required of Object.keys(REQUIRED_LEVELS)) {
      expect(await decide({ memberRole: 'artista', handlerRoles: [required] })).toBe(
        await decide({ memberRole: 'artist', handlerRoles: [required] }),
      );
      expect(await decide({ memberRole: 'tenant_owner', handlerRoles: [required] })).toBe(
        await decide({ memberRole: 'owner', handlerRoles: [required] }),
      );
    }
  });

  it('several accepted roles: the lowest accepted level wins (OR within one decorator)', async () => {
    expect(await decide({ memberRole: 'editor', handlerRoles: ['admin', 'editor'] })).toBe('ALLOW');
    expect(await decide({ memberRole: 'viewer', handlerRoles: ['admin', 'editor'] })).toBe('DENY');
  });

  it('class and handler requirements are ANDed (highest of the two levels)', async () => {
    expect(await decide({ memberRole: 'manager', classRoles: ['viewer'], handlerRoles: ['admin'] })).toBe('DENY');
    expect(await decide({ memberRole: 'admin', classRoles: ['viewer'], handlerRoles: ['admin'] })).toBe('ALLOW');
    expect(await decide({ memberRole: 'editor', classRoles: ['manager'], handlerRoles: ['viewer'] })).toBe('DENY');
  });

  it('class-level requirement alone is enforced', async () => {
    expect(await decide({ memberRole: 'viewer', classRoles: ['editor'] })).toBe('DENY');
    expect(await decide({ memberRole: 'editor', classRoles: ['editor'] })).toBe('ALLOW');
  });
});

describe('RolesGuard characterization: fail-closed rules', () => {
  it('unknown member role -> deny, even for the lowest requirement (level 0)', async () => {
    expect(await decide({ memberRole: 'not_a_role', handlerRoles: ['viewer'] })).toBe('DENY');
  });

  it('unknown required role -> deny for every known member role including super_admin (level 99 vs 100 is the only exception)', async () => {
    for (const [member, level] of Object.entries(ROLE_LEVELS)) {
      const expected = level >= 99 ? 'ALLOW' : 'DENY';
      expect({ member, d: await decide({ memberRole: member, handlerRoles: ['no_such_required_role'] }) }).toEqual({
        member,
        d: expected,
      });
    }
  });

  it('unknown required role alongside a known one uses the known (lower) level', async () => {
    expect(await decide({ memberRole: 'editor', handlerRoles: ['no_such_role', 'editor'] })).toBe('ALLOW');
  });

  it('member without a role field defaults to viewer (level 10)', async () => {
    expect(await decide({ memberRole: undefined, handlerRoles: ['viewer'] })).toBe('ALLOW');
    expect(await decide({ memberRole: undefined, handlerRoles: ['editor'] })).toBe('DENY');
  });

  it('missing membership context on a role-protected route -> deny', async () => {
    expect(await decide({ hasMember: false, handlerRoles: ['viewer'] })).toBe('DENY');
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE', 'post', 'delete'])(
    'mutable route %s with no role requirement -> deny (fail-closed) even for super_admin',
    async (method) => {
      expect(await decide({ method, memberRole: 'super_admin' })).toBe('DENY');
      expect(await decide({ method, memberRole: 'super_admin', handlerRoles: [], classRoles: [] })).toBe('DENY');
    },
  );

  it.each(['GET', 'HEAD', 'OPTIONS'])('read route %s with no role requirement -> allow', async (method) => {
    expect(await decide({ method, memberRole: 'viewer' })).toBe('ALLOW');
  });

  it('the denial is a ForbiddenException with 403 status', async () => {
    const { guard, context } = build({ memberRole: 'viewer', handlerRoles: ['admin'] });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
  });
});
