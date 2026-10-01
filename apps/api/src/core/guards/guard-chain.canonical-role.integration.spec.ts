/**
 * RBAC S4a: the REAL guard chain (RateLimit -> JWT -> MustChangePassword -> Tenant -> Billing -> Roles),
 * assembled as in app.module.ts and driven over HTTP, must give a legacy role slug and its canonical
 * English slug IDENTICAL outcomes, both as the member's org_members.role and as the role declared in
 * @Roles(...). Negative cases: unknown/mixed-case/prototype-key roles are denied, and a canonical slug
 * never reaches a level its legacy twin does not (admin/owner routes stay closed).
 */
import 'reflect-metadata';
import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';

const mockPublicKey = { value: '' };
jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: jest.fn(
      (_kid: string, cb: (err: Error | null, key?: { getPublicKey: () => string }) => void) => {
        cb(null, { getPublicKey: () => mockPublicKey.value });
      },
    ),
  }));
});

import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from '../security/rate-limit.service';
import { JwtAuthGuard } from './auth.guard';
import { MustChangePasswordGuard } from './must-change-password.guard';
import { RbacErrorLogService } from '../rbac/rbac-error-log.service';
import { TenantGuard } from './tenant.guard';
import { TenantBootstrapResolver } from '../../database/tenant-bootstrap.resolver';
import { BillingEnforcementGuard } from './billing-enforcement.guard';
import { BillingEnforcementService } from '../../modules/billing/billing-enforcement.service';
import { RolesGuard } from './roles.guard';
import { RbacDecisionService } from '../rbac/rbac-decision.service';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';

let privateKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  mockPublicKey.value = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
});

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    expiresIn: '1h',
    keyid: 'test-kid',
    issuer: 'https://test.supabase.co/auth/v1',
    audience: 'authenticated',
  } as jwt.SignOptions);
}


const PAIRS: ReadonlyArray<readonly [legacy: string, canonical: string]> = [
  ['juridico', 'legal'],
  ['comercial', 'sales'],
  ['produtor', 'producer'],
  ['colaborador', 'collaborator'],
  ['rh_manager', 'hr_manager'],
  ['artista', 'artist'],
];

@Controller()
class RoleRoutes {
  @Roles('legal') @Get('need-legal') needLegal() { return { ok: true }; }
  @Roles('juridico') @Get('need-juridico') needJuridico() { return { ok: true }; }
  @Roles('sales') @Get('need-sales') needSales() { return { ok: true }; }
  @Roles('comercial') @Get('need-comercial') needComercial() { return { ok: true }; }
  @Roles('collaborator') @Get('need-collaborator') needCollaborator() { return { ok: true }; }
  @Roles('colaborador') @Get('need-colaborador') needColaborador() { return { ok: true }; }
  @Roles('viewer') @Get('need-viewer') needViewer() { return { ok: true }; }
  @Roles('manager') @Get('need-manager') needManager() { return { ok: true }; }
  @Roles('admin') @Get('need-admin') needAdmin() { return { ok: true }; }
  @Roles('owner') @Get('need-owner') needOwner() { return { ok: true }; }
}

const ROUTES = [
  'need-legal', 'need-juridico', 'need-sales', 'need-comercial', 'need-collaborator', 'need-colaborador',
  'need-viewer', 'need-manager', 'need-admin', 'need-owner',
];

describe('Guard chain: legacy and canonical role slugs are authorization-equivalent (S4a)', () => {
  let app: INestApplication;
  let resolveTenant: jest.Mock;
  let resolveMembership: jest.Mock;
  let getBillingState: jest.Mock;

  beforeAll(async () => {
    resolveTenant = jest.fn().mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    resolveMembership = jest.fn();
    getBillingState = jest.fn().mockResolvedValue({ status: 'active' });
    const moduleRef = await Test.createTestingModule({
      controllers: [RoleRoutes],
      providers: [
        Reflector,
        { provide: RateLimitService, useValue: { check: jest.fn().mockResolvedValue(undefined) } },
        { provide: ConfigService, useValue: { get: (key: string) => ({ SUPABASE_URL: 'https://test.supabase.co', NODE_ENV: 'test' })[key] } },
        { provide: RbacErrorLogService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: TenantBootstrapResolver, useValue: { resolveTenant, resolveMembership } },
        { provide: BillingEnforcementService, useValue: { getStateWithEscalation: getBillingState } },
        { provide: RbacDecisionService, useValue: { evaluate: jest.fn().mockResolvedValue(undefined) } },
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: MustChangePasswordGuard },
        { provide: APP_GUARD, useClass: TenantGuard },
        { provide: APP_GUARD, useClass: BillingEnforcementGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function status(memberRole: string, route: string, jwtRole: string = memberRole): Promise<number> {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: jwtRole } });
    resolveMembership.mockResolvedValue({ role: memberRole, role_id: 'role-x' });
    const res = await request(app.getHttpServer()).get(`/${route}`).set('Authorization', `Bearer ${token}`).set('X-Tenant-ID', 'org-1');
    return res.status;
  }

  it.each(PAIRS)('legacy %s and canonical %s get the same status on every route', async (legacy, canonical) => {
    for (const route of ROUTES) {
      expect({ route, status: await status(canonical, route) }).toEqual({ route, status: await status(legacy, route) });
    }
  });

  it.each(PAIRS)('a stale legacy JWT role with a canonical org_members.role (and the reverse) changes nothing for %s/%s', async (legacy, canonical) => {
    // RolesGuard authorizes on org_members.role (membership), never on the JWT claim copy.
    for (const route of ROUTES) {
      const base = await status(canonical, route);
      expect({ route, status: await status(canonical, route, legacy) }).toEqual({ route, status: base });
      expect({ route, status: await status(legacy, route, canonical) }).toEqual({ route, status: base });
    }
  });

  it.each(PAIRS)('%s/%s cross-satisfy each other as required role and never reach admin/owner', async (legacy, canonical) => {
    for (const member of [legacy, canonical]) {
      expect(await status(member, 'need-admin')).toBe(403);
      expect(await status(member, 'need-owner')).toBe(403);
      expect(await status(member, 'need-viewer')).toBe(200);
    }
    expect(await status('legal', 'need-juridico')).toBe(200);
    expect(await status('juridico', 'need-legal')).toBe(200);
    expect(await status('sales', 'need-comercial')).toBe(200);
    expect(await status('comercial', 'need-sales')).toBe(200);
    // level 20 is below level 55/45: a collaborator cannot satisfy legal/sales.
    expect(await status('collaborator', 'need-legal')).toBe(403);
    expect(await status('colaborador', 'need-sales')).toBe(403);
  });

  it.each(['LEGAL', 'Legal', ' legal', 'legal ', 'juridico_', 'legal\u0000', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'ghost', ''])(
    'unknown / malformed role %j is denied on every non-viewer route',
    async (role) => {
      for (const route of ROUTES.filter((r) => r !== 'need-viewer')) {
        expect({ route, status: await status(role, route) }).toEqual({ route, status: 403 });
      }
    },
  );

  it('a canonical slug in the JWT only (membership still a low role) does not escalate', async () => {
    expect(await status('viewer', 'need-legal', 'legal')).toBe(403);
    expect(await status('viewer', 'need-admin', 'legal')).toBe(403);
  });
});
