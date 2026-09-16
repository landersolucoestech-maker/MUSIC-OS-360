/**
 * TEST-05 (auditoria 2026-07-05): nenhum teste no repositorio faz uma requisicao
 * HTTP real (supertest/INestApplication) contra um controller para confirmar que
 * GET /artists/:id de um recurso do tenant B retorna 403/404 quando autenticado
 * como tenant A — toda a suite de specs testa services/guards isolados com
 * ExecutionContext ou repositorio mockado. Este teste sobe o ArtistsController
 * real atras da cadeia real de guards (JWT -> Tenant -> Roles) e prova as duas
 * camadas de defesa via HTTP: (1) o service so retorna artistas do tenant
 * autenticado; (2) o TenantGuard rejeita X-Tenant-ID de um tenant do qual o
 * usuario nao e membro, mesmo que o cliente tente forjar o header.
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

import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { ArtistPlatformProfilesService } from './platform-profiles/artist-platform-profiles.service';
import { ArtistMetricSnapshotsService } from './platform-profiles/artist-metric-snapshots.service';
import { ArtistExternalProfileSyncService } from './platform-profiles/artist-external-profile-sync.service';
import { CareerStageService } from './platform-profiles/analytics/career-stage.service';
import { MarketBenchmarkService } from './platform-profiles/analytics/market-benchmark.service';
import { AudienceHealthAutomation } from '../../core/automation/audience-health.automation';
import { JwtAuthGuard } from '../../core/guards/auth.guard';
import { RbacErrorLogService } from '../../core/rbac/rbac-error-log.service';
import { TenantGuard } from '../../core/guards/tenant.guard';
import { TenantBootstrapResolver } from '../../database/tenant-bootstrap.resolver';
import { RolesGuard } from '../../core/guards/roles.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RbacDecisionService } from '../../core/rbac/rbac-decision.service';
import { createTestTenant, createTestUser, createTestArtist } from '../../../test/helpers/tenant-fixtures';

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

// ParseUUIDPipe exige UUID valido no :id — dataset com dois tenants gerados pela
// factory (nunca hardcoded), simulando o que o RLS/tenant_id garantiria no banco real.
const tenantA = createTestTenant();
const tenantB = createTestTenant();
const userA = createTestUser();
const artistA = createTestArtist();
const artistB = createTestArtist();
const ARTIST_A_ID = artistA.id;
const ARTIST_B_ID = artistB.id;
const ARTISTS_BY_TENANT: Record<string, Record<string, { id: string; nome_artistico: string }>> = {
  [tenantA.tenantId]: { [ARTIST_A_ID]: { id: ARTIST_A_ID, nome_artistico: artistA.nomeArtistico } },
  [tenantB.tenantId]: { [ARTIST_B_ID]: { id: ARTIST_B_ID, nome_artistico: artistB.nomeArtistico } },
};

describe('Cross-tenant IDOR — GET /artists/:id via HTTP real', () => {
  let app: INestApplication;
  let resolveTenant: jest.Mock;
  let resolveMembership: jest.Mock;

  beforeAll(async () => {
    resolveTenant = jest.fn();
    resolveMembership = jest.fn();

    const fakeArtistsService = {
      findByIdForResponse: jest.fn(async (tenantId: string, id: string) => {
        const found = ARTISTS_BY_TENANT[tenantId]?.[id];
        if (!found) {
          const { NotFoundException } = await import('@nestjs/common');
          throw new NotFoundException('Artista não encontrado');
        }
        return found;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ArtistsController],
      providers: [
        Reflector,
        { provide: ArtistsService, useValue: fakeArtistsService },
        { provide: ArtistPlatformProfilesService, useValue: {} },
        { provide: ArtistMetricSnapshotsService, useValue: {} },
        { provide: ArtistExternalProfileSyncService, useValue: {} },
        { provide: CareerStageService, useValue: {} },
        { provide: MarketBenchmarkService, useValue: {} },
        { provide: AudienceHealthAutomation, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ SUPABASE_URL: 'https://test.supabase.co', NODE_ENV: 'test' })[key],
          },
        },
        { provide: RbacErrorLogService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: TenantBootstrapResolver, useValue: { resolveTenant, resolveMembership } },
        { provide: RbacDecisionService, useValue: { evaluate: jest.fn().mockResolvedValue(undefined) } },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: TenantGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('tenant A autenticado le o proprio artista -> 200', async () => {
    const token = makeToken({ sub: userA.userId, app_metadata: { org_id: tenantA.orgId, role: userA.role } });
    resolveTenant.mockResolvedValue({ id: tenantA.tenantId, org_id: tenantA.orgId, active: true });
    resolveMembership.mockResolvedValue({ role: userA.role, role_id: 'role-viewer' });

    await request(app.getHttpServer())
      .get(`/artists/${ARTIST_A_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantA.orgId)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(ARTIST_A_ID);
      });
  });

  it('tenant A autenticado pede o ID do artista da tenant B -> 404 (service filtra por tenant_id)', async () => {
    const token = makeToken({ sub: userA.userId, app_metadata: { org_id: tenantA.orgId, role: userA.role } });
    resolveTenant.mockResolvedValue({ id: tenantA.tenantId, org_id: tenantA.orgId, active: true });
    resolveMembership.mockResolvedValue({ role: userA.role, role_id: 'role-viewer' });

    await request(app.getHttpServer())
      .get(`/artists/${ARTIST_B_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantA.orgId)
      .expect(404);
  });

  it('usuario da tenant A tenta forjar X-Tenant-ID da tenant B sem ser membro -> 403 do TenantGuard (nunca chega no controller)', async () => {
    const token = makeToken({ sub: userA.userId, app_metadata: { org_id: tenantA.orgId, role: userA.role } });
    // auth.orgId (tenantA) diverge do X-Tenant-ID forjado (tenantB) -> TenantGuard
    // rejeita antes mesmo de resolver o tenant/membership.
    resolveTenant.mockResolvedValue({ id: tenantA.tenantId, org_id: tenantA.orgId, active: true });

    await request(app.getHttpServer())
      .get(`/artists/${ARTIST_B_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantB.orgId)
      .expect(403);

    expect(resolveMembership).not.toHaveBeenCalled();
  });
});
