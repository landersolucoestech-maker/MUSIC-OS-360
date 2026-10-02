import 'reflect-metadata';

jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RbacDecisionService } from '../rbac/rbac-decision.service';
import { ROLE_HIERARCHY, roleLevel, toCanonicalRoleSlug } from '../rbac/role-hierarchy';
import { RolesGuard } from './roles.guard';

/**
 * Contract of the persisted legacy (Portuguese) role slugs: each one must keep
 * its pinned hierarchy level, be authorized by RolesGuard exactly like its
 * canonical English alias, and stay a valid REQUIRED role. Breaking the alias
 * handling (removing a legacy level, or drifting a level from its canonical
 * twin) flips a guard decision here.
 */
const LEGACY_ROLES: ReadonlyArray<readonly [legacy: string, canonical: string, level: number]> = [
  ['juridico', 'legal', 55],
  ['comercial', 'sales', 45],
  ['produtor', 'producer', 40],
  ['colaborador', 'collaborator', 20],
  ['rh_manager', 'hr_manager', 55],
  ['artista', 'artist', 30],
];
const PROBE_REQUIRED = ['viewer', 'editor', 'manager', 'admin', 'owner', 'super_admin'] as const;

const HANDLER = function handler(): void {};
class Controller {}

async function decide(memberRole: string, handlerRoles: string[]): Promise<'ALLOW' | 'DENY'> {
  const request = { method: 'GET', url: '/x', currentMember: { id: 'm', tenant_id: 't', role: memberRole } };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
    get: jest.fn((key: string, target: unknown) => (key === ROLES_KEY && target === HANDLER ? handlerRoles : undefined)),
  } as unknown as Reflector;
  const decisions = { evaluate: jest.fn().mockResolvedValue('DENY') } as unknown as RbacDecisionService;
  const context = {
    getHandler: () => HANDLER,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  try {
    return (await new RolesGuard(reflector, decisions).canActivate(context)) === true ? 'ALLOW' : 'DENY';
  } catch (err) {
    if (err instanceof ForbiddenException) return 'DENY';
    throw err;
  }
}

describe('legacy role slug alias contract', () => {
  it.each(LEGACY_ROLES)('%s keeps its pinned level, equal to canonical %s (level %i)', (legacy, canonical, level) => {
    expect(roleLevel(legacy)).toBe(level);
    expect(roleLevel(canonical)).toBe(level);
    expect(ROLE_HIERARCHY[legacy]).toBe(ROLE_HIERARCHY[canonical]);
    expect(toCanonicalRoleSlug(legacy)).toBe(canonical);
  });

  describe.each(LEGACY_ROLES)('%s vs %s', (legacy, canonical, level) => {
    it.each(PROBE_REQUIRED)('member decisions are identical against @RequireRole(%s)', async (required) => {
      const asLegacy = await decide(legacy, [required]);
      const asCanonical = await decide(canonical, [required]);
      expect(asLegacy).toBe(asCanonical);
      expect(asLegacy).toBe(level >= (roleLevel(required) as number) ? 'ALLOW' : 'DENY');
    });

    it('a legacy slug is a valid required role: it admits itself and its canonical twin, and denies a lower role', async () => {
      expect(await decide(legacy, [legacy])).toBe('ALLOW');
      expect(await decide(canonical, [legacy])).toBe('ALLOW');
      expect(await decide(canonical, [canonical])).toBe('ALLOW');
      expect(await decide('viewer', [legacy])).toBe(level <= 10 ? 'ALLOW' : 'DENY');
    });
  });

  it('negative: an unknown or prototype-key member role is denied, never promoted by alias handling', async () => {
    for (const bogus of ['juridicoo', 'constructor', '__proto__', 'toString']) {
      expect(await decide(bogus, ['viewer'])).toBe('DENY');
    }
  });

  it('negative: legacy roles do not outrank their level (collaborator-class cannot pass editor)', async () => {
    expect(await decide('colaborador', ['editor'])).toBe('DENY');
    expect(await decide('collaborator', ['editor'])).toBe('DENY');
    expect(await decide('juridico', ['manager'])).toBe('DENY');
  });
});
