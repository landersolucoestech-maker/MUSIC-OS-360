import 'reflect-metadata';
import { generateKeyPairSync } from 'crypto';

const mockPublicKey = { value: '' };

jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: jest.fn((_kid: string, cb: (err: Error | null, key?: { getPublicKey: () => string }) => void) => {
      cb(null, { getPublicKey: () => mockPublicKey.value });
    }),
  }));
});

import { JwtAuthGuard, IS_PUBLIC_KEY } from './auth.guard';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';

let privateKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  mockPublicKey.value = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
});

function makeGuard(isPublic = false, envOverrides: Record<string, string> = {}): JwtAuthGuard {
  const config = {
    get: jest.fn((key: string) => ({
      SUPABASE_URL: 'https://test.supabase.co',
      NODE_ENV: 'test',
      ENCRYPTION_KEY: '0'.repeat(64),
      ...envOverrides,
    }[key])),
  } as unknown as ConfigService;

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;

  const errorLog = {
    record: jest.fn().mockResolvedValue(undefined),
  } as any;

  const guard = new JwtAuthGuard(config, reflector, errorLog);
  guard.onModuleInit();
  return guard;
}

function makeToken(payload: Record<string, unknown>, expiresIn = '1h'): string {
  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    expiresIn,
    keyid: 'test-kid',
    // P0-09: auth.guard requires issuer + audience match; must mirror onModuleInit values.
    issuer:   'https://test.supabase.co/auth/v1',
    audience: 'authenticated',
  } as jwt.SignOptions);
}

function makeContext(opts: { authHeader?: string } = {}) {
  const request: Record<string, unknown> = { headers: {} };
  if (opts.authHeader) {
    (request.headers as Record<string, string>)['authorization'] = opts.authHeader;
  }
  return {
    getHandler:   jest.fn(),
    getClass:     jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  } as any;
}

describe('JwtAuthGuard', () => {
  afterEach(() => jest.clearAllMocks());

  it('rota @Public() retorna true sem verificar token', async () => {
    const guard = makeGuard(true);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('ausencia de token lanca UnauthorizedException', async () => {
    const guard = makeGuard(false);
    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it('token JWT malformado lanca UnauthorizedException', async () => {
    const guard = makeGuard(false);
    await expect(
      guard.canActivate(makeContext({ authHeader: 'Bearer not-a-jwt' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('token expirado lanca UnauthorizedException', async () => {
    const expired = jwt.sign(
      { sub: 'user_1', iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 },
      privateKey,
      { algorithm: 'ES256', keyid: 'test-kid' } as jwt.SignOptions,
    );
    const guard = makeGuard(false);
    await expect(
      guard.canActivate(makeContext({ authHeader: `Bearer ${expired}` })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('token Bearer valido com app_metadata define request.auth e retorna true', async () => {
    const token = makeToken({
      sub: 'user-abc123',
      session_id: 'sess-xyz',
      app_metadata: { org_id: 'org-tenant1', role: 'admin' },
    });

    const guard = makeGuard(false);
    const ctx = makeContext({ authHeader: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    const request = ctx.switchToHttp().getRequest();
    expect(request.auth).toMatchObject({
      userId: 'user-abc123',
      orgId: 'org-tenant1',
      orgRole: 'admin',
    });
    expect(request.auth.sessionId).toBe('sess-xyz');
  });

  it('token sem app_metadata resulta em orgId null', async () => {
    const token = makeToken({ sub: 'user-no-org' });
    const guard = makeGuard(false);
    const ctx = makeContext({ authHeader: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    const request = ctx.switchToHttp().getRequest();
    expect(request.auth.orgId).toBeNull();
    expect(request.auth.orgRole).toBeNull();
  });

  it('IS_PUBLIC_KEY e exportado', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  describe('SEC-01: dev-token bypass deve ser bloqueado em staging', () => {
    function makeDevToken(): string {
      return jwt.sign(
        { sub: 'attacker', app_metadata: { org_id: 'victim-tenant', role: 'admin' } },
        '0'.repeat(64),
        { algorithm: 'HS256', issuer: 'music-os-360-dev' },
      );
    }

    it('aceita dev-token HS256 quando NODE_ENV=development (comportamento existente)', async () => {
      const guard = makeGuard(false, { NODE_ENV: 'development' });
      const ctx = makeContext({ authHeader: `Bearer ${makeDevToken()}` });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(ctx.switchToHttp().getRequest().auth.userId).toBe('attacker');
    });

    it('rejeita dev-token HS256 quando NODE_ENV=staging (deve cair para verificacao JWKS real e falhar)', async () => {
      const guard = makeGuard(false, { NODE_ENV: 'staging' });
      const ctx = makeContext({ authHeader: `Bearer ${makeDevToken()}` });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it.each(['Production', ' production ', 'STAGING', 'Staging'])(
      'rejeita dev-token HS256 quando NODE_ENV=%j (variacao de caixa/espaco deve continuar prod-like -- CODEBASE_MAP Gotcha #9)',
      async (nodeEnv) => {
        const guard = makeGuard(false, { NODE_ENV: nodeEnv });
        const ctx = makeContext({ authHeader: `Bearer ${makeDevToken()}` });
        await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      },
    );
  });
});
