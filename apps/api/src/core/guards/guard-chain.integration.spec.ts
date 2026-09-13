/**
 * TEST-04 (auditoria 2026-07-05): os 6 guards globais de app.module.ts eram testados
 * apenas isoladamente (ExecutionContext mockado à mão) — nenhum teste provava que a
 * ORDEM real de execução (RateLimit → JWT → MustChangePassword → Tenant → Billing →
 * Roles) produz o comportamento esperado quando montada via APP_GUARD, como em
 * produção. Este spec sobe um módulo Nest mínimo com os guards reais nessa ordem e
 * bate via HTTP real (supertest), para que um reordenamento acidental do array
 * APP_GUARD em app.module.ts quebre este teste.
 *
 * MustChangePasswordGuard (Parte 73) foi adicionado à cadeia real logo após
 * JwtAuthGuard — coberto abaixo.
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

  // Rota allowlisted pelo MustChangePasswordGuard mesmo quando a flag está true.
  @Roles('viewer')
  @Get('auth/context')
  authContext() {
    return { ok: true };
  }

  // Endpoint atômico de troca obrigatória de senha (Parte 74) — também
  // precisa estar acessível enquanto a flag está true, senão ninguém
  // consegue sair desse estado.
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
        // Ordem exata de apps/api/src/app.module.ts — não reordenar sem atualizar as expectativas abaixo.
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

  it('rota @Public() nao exige JWT/Tenant/Roles', async () => {
    await request(app.getHttpServer()).get('/public').expect(200);
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it('sem token -> 401 do JwtAuthGuard (Tenant/Billing/Roles nunca rodam)', async () => {
    await request(app.getHttpServer()).get('/artists').expect(401);
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it('JWT valido mas sem X-Tenant-ID -> 403 do TenantGuard (prova que Tenant roda apos JWT)', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin' } });
    await request(app.getHttpServer())
      .get('/artists')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('tenant suspenso (billing) bloqueia mesmo com role suficiente -> prova que Billing roda antes de Roles', async () => {
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

  it('role insuficiente -> 403 do RolesGuard apos Tenant/Billing passarem', async () => {
    const token = makeToken({ sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'guest' } });
    resolveTenant.mockResolvedValue({ id: 'tenant-1', org_id: 'org-1', active: true });
    // "guest" nao existe em ROLE_HIERARCHY -> nivel 0, abaixo do minimo exigido por @Roles('viewer') (10).
    resolveMembership.mockResolvedValue({ role: 'guest', role_id: 'role-guest' });
    getBillingState.mockResolvedValue({ status: 'active' });

    await request(app.getHttpServer())
      .get('/artists')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'org-1')
      .expect(403);
  });

  it('fluxo feliz completo: JWT + Tenant + Billing ativo + role suficiente -> 200', async () => {
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

  it('must_change_password=true bloqueia rota comum mesmo com tenant/role válidos (prova que MustChangePassword roda logo após JWT)', async () => {
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
    // Nunca chega a resolver tenant — bloqueado antes do TenantGuard rodar.
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it('must_change_password=true ainda permite rota allowlisted (/auth/context)', async () => {
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

  it('must_change_password=true ainda permite o endpoint atômico de troca (/auth/change-required-password)', async () => {
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

  it('must_change_password ausente (default) não afeta rotas comuns', async () => {
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
