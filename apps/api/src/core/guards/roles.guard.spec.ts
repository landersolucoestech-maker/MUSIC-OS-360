import 'reflect-metadata';

jest.mock('jwks-rsa', () =>
  jest.fn(() => ({ getSigningKey: jest.fn() })),
);

import {
  ForbiddenException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RbacDecisionService } from '../rbac/rbac-decision.service';
import { RolesGuard } from './roles.guard';

const HANDLER = function handler(): void {};
class Controller {}

function setup(role: string, requiredRole: string, permission: string) {
  const request = {
    method: 'DELETE',
    url: '/artists/1',
    requestId: 'req-1',
    currentMember: {
      id: 'member-1',
      tenant_id: 'tenant-1',
      role,
      role_id: 'role-1',
    },
  };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
    get: jest.fn((key: string, target: unknown) => {
      if (key === ROLES_KEY) {
        return target === HANDLER ? [requiredRole] : [];
      }
      if (key === PERMISSIONS_KEY) {
        return target === HANDLER ? [permission] : [];
      }
      return undefined;
    }),
  } as unknown as Reflector;
  const decisions = {
    evaluate: jest.fn().mockResolvedValue('DENY'),
  } as unknown as RbacDecisionService;
  const context = {
    getHandler: () => HANDLER,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return {
    guard: new RolesGuard(reflector, decisions),
    decisions,
    context,
    request,
  };
}

describe('RolesGuard dual-read ordering', () => {
  it('collects shadow telemetry before throwing an active deny', async () => {
    const { guard, decisions, context, request } = setup(
      'viewer',
      'manager',
      'artist:delete',
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(decisions.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        request,
        requiredPermissions: ['artist:delete'],
        active: expect.objectContaining({
          decision: 'DENY',
          reason: 'insufficient_role_hierarchy',
        }),
      }),
    );
  });

  it('stores the active allow for PermissionsGuard to complete', async () => {
    const { guard, decisions, context, request } = setup(
      'manager',
      'viewer',
      'artist:read',
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(decisions.evaluate).not.toHaveBeenCalled();
    expect(
      (request as typeof request & { rbacActiveDecision?: unknown })
        .rbacActiveDecision,
    ).toEqual(
      expect.objectContaining({ decision: 'ALLOW' }),
    );
  });
});

describe('RolesGuard — denial end-user copy', () => {
  it('answers with PT-BR copy and a machine code, never the role slugs or the route', async () => {
    const { guard, context } = setup('viewer', 'manager', 'artist:delete');
    const denial = await guard.canActivate(context).then(
      () => { throw new Error('expected a denial'); },
      (err: unknown) => err as ForbiddenException,
    );
    const body = denial.getResponse() as { error: string; message: string };
    expect(body.error).toBe('PERMISSION_DENIED');
    expect(body.message).toBe('Você não tem permissão para realizar esta ação.');
    expect(body.message).not.toMatch(/viewer|manager|artists|DELETE/);
  });
});
