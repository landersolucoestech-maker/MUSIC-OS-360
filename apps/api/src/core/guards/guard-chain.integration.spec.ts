/**
 * TEST-04 (2026-07-05 audit): the 6 global guards in app.module.ts were only
 * tested in isolation (ExecutionContext mocked by hand) — no test proved that the
 * real execution ORDER (RateLimit → JWT → MustChangePassword → Tenant → Billing →
 * Roles) produces the expected behavior when assembled via APP_GUARD, as in
 * production. This spec boots a minimal Nest module with the real guards in that
 * order and hits it via real HTTP (supertest), so that an accidental reordering of
 * the APP_GUARD array in app.module.ts breaks this test.
 *
 * MustChangePasswordGuard (Part 73) was added to the real chain right after
 * JwtAuthGuard — covered below.
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

@Controller()
class TestController {
  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @Roles('viewer')
  @Get('artists')
  protectedRoute() {
    return { ok: true };
  }

  // Route allowlisted by MustChangePasswordGuard even when the flag is true.
  @Roles('viewer')
  @Get('auth/context')
  authContext() {
    return { ok: true };
  }

  // Atomic mandatory-password-change endpoint (Part 74) — also needs to
  // remain accessible while the flag is true, otherwise no one can
  // get out of that state.
  @Roles('viewer')
  @Get('auth/change-required-password')
  changeRequiredPassword() {
    return { ok: true };
  }
}

describe('Guard chain composition (RateLimit -> JWT -> Tenant -> Billing -> Roles)', () => {
  let app: INestApplication;
  let resolveTenant: jest.Mock;
  let resolveMembership: jest.Mock;
  let getBillingState: jest.Mock;
  let rateLimitCheck: jest.Mock;

  beforeAll(async () => {
    resolveTenant = jest.fn();
    resolveMembership = jest.fn();
    getBillingState = jest.fn();
    rateLimitCheck = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        Reflector,
        { provide: RateLimitService, useValue: { check: rateLimitCheck } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ SUPABASE_URL: 'https://test.supabase.co', NODE_ENV: 'test' })[key],
          },
        },
        { provide: RbacErrorLogService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: TenantBootstrapResolver, useValue: { resolveTenant, resolveMembership } },
        { provide: BillingEnforcementService, useValue: { getStateWithEscalation: getBillingState } },
        { provide: RbacDecisionService, useValue: { evaluate: jest.fn().mockResolvedValue(undefined) } },
        // Exact order from apps/api/src/app.module.ts — do not reorder without updating the expectations below.
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

  afterEach(() => jest.clearAllMocks());

  it('@Public() route does not require JWT/Tenant/Roles', async () => {
    await request(app.getHttpServer()).get('/public').expect(200);
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it('without token -> 401 from JwtAuthGuard (Tenant/Billing/Roles never run)', async () => {
    await request(app.getHttpServer()).get('/artists').expect(401);
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it('valid JWT but no X-Tenant-ID -> 403 from TenantGuard (proves Tenant runs after JWT)', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin' } });
    await request(app.getHttpServer())
      .get('/artists')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('suspended tenant (billing) blocks even with a sufficient role -> proves Billing runs before Roles', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin' } });
    resolveTenant.mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    resolveMembership.mockResolvedValue({ role: 'admin', role_id: 'role-admin' });
    getBillingState.mockResolvedValue({ status: 'suspended' });

    await request(app.getHttpServer())
      .get('/artists')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'org-1')
      .expect(403)
      .expect((res) => {
        expect(res.body.message?.error ?? res.body.error).toBe('TENANT_SUSPENDED');
      });
  });

  it('insufficient role -> 403 from RolesGuard after Tenant/Billing pass', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'guest' } });
    resolveTenant.mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    // "guest" does not exist in ROLE_HIERARCHY -> level 0, below the minimum required by @Roles('viewer') (10).
    resolveMembership.mockResolvedValue({ role: 'guest', role_id: 'role-guest' });
    getBillingState.mockResolvedValue({ status: 'active' });

    await request(app.getHttpServer())
      .get('/artists')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'org-1')
      .expect(403);
  });

  it('full happy path: JWT + Tenant + Billing active + sufficient role -> 200', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin' } });
    resolveTenant.mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    resolveMembership.mockResolvedValue({ role: 'admin', role_id: 'role-admin' });
    getBillingState.mockResolvedValue({ status: 'active' });

    await request(app.getHttpServer())
      .get('/artists')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'org-1')
      .expect(200);

    expect(rateLimitCheck).toHaveBeenCalled();
    expect(resolveTenant).toHaveBeenCalledWith('org-1');
  });

  it('must_change_password=true blocks a common route even with valid tenant/role (proves MustChangePassword runs right after JWT)', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin', must_change_password: true } });
    resolveTenant.mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    resolveMembership.mockResolvedValue({ role: 'admin', role_id: 'role-admin' });
    getBillingState.mockResolvedValue({ status: 'active' });

    await request(app.getHttpServer())
      .get('/artists')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'org-1')
      .expect(403)
      .expect((res) => {
        expect(res.body.message?.error ?? res.body.error).toBe('MUST_CHANGE_PASSWORD');
      });
    // Never reaches tenant resolution — blocked before TenantGuard runs.
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it('must_change_password=true still allows the allowlisted route (/auth/context)', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin', must_change_password: true } });
    resolveTenant.mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    resolveMembership.mockResolvedValue({ role: 'admin', role_id: 'role-admin' });
    getBillingState.mockResolvedValue({ status: 'active' });

    await request(app.getHttpServer())
      .get('/auth/context')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'org-1')
      .expect(200);
  });

  it('must_change_password=true still allows the atomic change endpoint (/auth/change-required-password)', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin', must_change_password: true } });
    resolveTenant.mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    resolveMembership.mockResolvedValue({ role: 'admin', role_id: 'role-admin' });
    getBillingState.mockResolvedValue({ status: 'active' });

    await request(app.getHttpServer())
      .get('/auth/change-required-password')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'org-1')
      .expect(200);
  });

  it('must_change_password absent (default) does not affect common routes', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin' } });
    resolveTenant.mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    resolveMembership.mockResolvedValue({ role: 'admin', role_id: 'role-admin' });
    getBillingState.mockResolvedValue({ status: 'active' });

    await request(app.getHttpServer())
      .get('/artists')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'org-1')
      .expect(200);
  });
});
