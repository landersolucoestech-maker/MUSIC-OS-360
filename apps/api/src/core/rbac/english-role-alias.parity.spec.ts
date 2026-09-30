import 'reflect-metadata';

jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { CAMPAIGNS_WORKFLOW } from '../workflow/definitions/campaigns.workflow';
import { CONTRACTS_WORKFLOW } from '../workflow/definitions/contracts.workflow';
import { LEADS_WORKFLOW } from '../workflow/definitions/leads.workflow';
import { PROJECTS_WORKFLOW } from '../workflow/definitions/projects.workflow';
import { RELEASES_WORKFLOW } from '../workflow/definitions/releases.workflow';
import { TICKETS_WORKFLOW } from '../workflow/definitions/tickets.workflow';
import type { WorkflowDefinition } from '../workflow/workflow.types';
import type { PermissionResolverService } from './permission-resolver.service';
import type { RbacDecisionService } from './rbac-decision.service';
import { RbacService, ROLE_HIERARCHY, ROLE_PERMISSIONS } from './rbac.service';
import { ENGLISH_ROLE_ALIASES } from './role-hierarchy';

/**
 * RBAC expand step (S2/S3): every English alias must be authorization-equivalent to its canonical
 * Portuguese role at every enforcement point that reads a role slug: RolesGuard level (as member
 * role AND as declared required role), RbacService (hasRole/level/permissions) and every workflow
 * transition. Aliases are inert in production until a member holds one (roles.is_assignable = false).
 */
const PAIRS = Object.entries(ENGLISH_ROLE_ALIASES);
const ALL_SLUGS = Object.keys(ROLE_HIERARCHY);

const HANDLER = function handler(): void {};
class Controller {}

async function guardDecision(memberRole: string, required: string): Promise<'ALLOW' | 'DENY'> {
  const request = {
    method: 'GET',
    url: '/things/1',
    currentMember: { id: 'm', tenant_id: 't', role: memberRole },
  };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
    get: jest.fn((key: string, target: unknown) => (key === ROLES_KEY && target === HANDLER ? [required] : undefined)),
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

describe('English role aliases: canonical mapping', () => {
  it('maps exactly the five English slugs that had no English form (pinned literally in role-hierarchy.spec.ts)', () => {
    expect(Object.keys(ENGLISH_ROLE_ALIASES).sort()).toEqual(['collaborator', 'hr_manager', 'legal', 'producer', 'sales']);
  });

  it('never removes or shadows a persisted Portuguese slug (aliases are additive, canonical kept)', () => {
    for (const [alias, canonical] of PAIRS) {
      expect(ROLE_HIERARCHY[canonical]).toBeDefined();
      expect(ROLE_PERMISSIONS[canonical]).toBeDefined();
      expect(ROLE_HIERARCHY[alias]).toBeDefined();
      expect(Object.keys(ENGLISH_ROLE_ALIASES)).not.toContain(canonical);
    }
  });
});

describe.each(PAIRS)('English alias %s == canonical %s', (alias, canonical) => {
  it('RbacService: same level, same legacy permissions, hasRole identical both ways', () => {
    const service = new RbacService({} as unknown as PermissionResolverService);
    expect(service.getHierarchyLevel(alias)).toBe(service.getHierarchyLevel(canonical));
    expect(service.getPermissions(alias)).toEqual(service.getPermissions(canonical));
    expect(service.getPermissions(alias).length).toBeGreaterThan(0);
    // No shared mutable array between alias and canonical.
    expect(service.getPermissions(alias)).not.toBe(service.getPermissions(canonical));
    for (const other of ALL_SLUGS) {
      expect({ other, asUser: service.hasRole(alias, other) }).toEqual({ other, asUser: service.hasRole(canonical, other) });
      expect({ other, asRequired: service.hasRole(other, alias) }).toEqual({ other, asRequired: service.hasRole(other, canonical) });
    }
    for (const perm of new Set(Object.values(ROLE_PERMISSIONS).flat())) {
      const [resource, action] = perm.split(':');
      expect(service.can(alias, resource as never, action as never)).toBe(service.can(canonical, resource as never, action as never));
    }
  });

  it('RolesGuard: identical decision as member role and as declared required role, against every slug', async () => {
    for (const other of ALL_SLUGS) {
      expect({ other, asMember: await guardDecision(alias, other) }).toEqual({ other, asMember: await guardDecision(canonical, other) });
      expect({ other, asRequired: await guardDecision(other, alias) }).toEqual({ other, asRequired: await guardDecision(other, canonical) });
    }
  });

  it('never widens: the alias is denied wherever the canonical role is denied (unknown and higher-level requirements)', async () => {
    for (const required of ['admin', 'owner', 'super_admin', 'manager']) {
      const canonicalDecision = await guardDecision(canonical, required);
      const aliasDecision = await guardDecision(alias, required);
      expect(aliasDecision).toBe(canonicalDecision);
      if (ROLE_HIERARCHY[canonical] < ROLE_HIERARCHY[required]) expect(aliasDecision).toBe('DENY');
    }
    expect(await guardDecision(alias, 'not_a_role')).toBe('DENY');
  });
});

describe('workflow transitions: alias == canonical for every definition and every transition', () => {
  const definitions: Array<[string, WorkflowDefinition<string>]> = [
    ['campaigns', CAMPAIGNS_WORKFLOW],
    ['contracts', CONTRACTS_WORKFLOW],
    ['leads', LEADS_WORKFLOW],
    ['projects', PROJECTS_WORKFLOW],
    ['releases', RELEASES_WORKFLOW],
    ['tickets', TICKETS_WORKFLOW],
  ];

  it.each(definitions)('%s', (_name, definition) => {
    const engine = new WorkflowEngine(definition);
    let checked = 0;
    for (const transition of definition.transitions) {
      const froms = Array.isArray(transition.from) ? transition.from : [transition.from];
      for (const [alias, canonical] of PAIRS) {
        // The Portuguese slug must stay authorized wherever it was (no removal) and the alias mirrors it.
        expect(transition.roles?.includes(alias)).toBe(transition.roles?.includes(canonical));
        for (const from of froms) {
          expect(engine.canTransition(from, transition.to, alias)).toBe(engine.canTransition(from, transition.to, canonical));
          expect(engine.getAllowedTransitions(from, alias)).toEqual(engine.getAllowedTransitions(from, canonical));
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('an alias role is rejected by transition() exactly when its canonical role is (role_not_authorized)', async () => {
    const engine = new WorkflowEngine(CONTRACTS_WORKFLOW);
    const attempt = async (role: string) =>
      engine
        .transition({
          fromStatus: 'awaiting_signature',
          toStatus: 'signed',
          actorRole: role,
          entity: { file_url: 'x' },
        } as never)
        .then(() => 'OK')
        .catch((e: { code?: string; reason?: string }) => e.code ?? e.reason ?? 'ERR');
    expect(await attempt('legal')).toBe(await attempt('juridico'));
    expect(await attempt('legal')).not.toBe('OK');
  });
});
