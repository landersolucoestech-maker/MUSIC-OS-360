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

  it('@Public() route returns true without verifying the token', async () => {
    const guard = makeGuard(true);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('missing token throws UnauthorizedException', async () => {
    const guard = makeGuard(false);
    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it('malformed JWT token throws UnauthorizedException', async () => {
    const guard = makeGuard(false);
    await expect(
      guard.canActivate(makeContext({ authHeader: 'Bearer not-a-jwt' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('expired token throws UnauthorizedException', async () => {
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

  it('valid Bearer token with app_metadata sets request.auth and returns true', async () => {
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

  it('token without app_metadata results in orgId null', async () => {
    const token = makeToken({ sub: 'user-no-org' });
    const guard = makeGuard(false);
    const ctx = makeContext({ authHeader: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    const request = ctx.switchToHttp().getRequest();
    expect(request.auth.orgId).toBeNull();
    expect(request.auth.orgRole).toBeNull();
  });

  it('IS_PUBLIC_KEY is exported', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  describe('SEC-01: dev-token bypass must be blocked in staging', () => {
    // Non-zero key: the all-zero default key is rejected for dev tokens (F4).
    const DEV_KEY = 'ab12'.repeat(16);

    function makeDevToken(opts: { key?: string; expiresIn?: string | null; issuer?: string } = {}): string {
      const signOpts: jwt.SignOptions = { algorithm: 'HS256', issuer: opts.issuer ?? 'music-os-360-dev' };
      if (opts.expiresIn !== null) signOpts.expiresIn = (opts.expiresIn ?? '1h') as jwt.SignOptions['expiresIn'];
      return jwt.sign(
        { sub: 'attacker', app_metadata: { org_id: 'victim-tenant', role: 'admin' } },
        opts.key ?? DEV_KEY,
        signOpts,
      );
    }

    it('accepts an HS256 dev-token (with exp, non-zero key) when NODE_ENV=development (existing behavior)', async () => {
      const guard = makeGuard(false, { NODE_ENV: 'development', ENCRYPTION_KEY: DEV_KEY });
      const ctx = makeContext({ authHeader: `Bearer ${makeDevToken()}` });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(ctx.switchToHttp().getRequest().auth.userId).toBe('attacker');
    });

    it('F4: rejects a dev-token without an exp claim even in development', async () => {
      const guard = makeGuard(false, { NODE_ENV: 'development', ENCRYPTION_KEY: DEV_KEY });
      const ctx = makeContext({ authHeader: `Bearer ${makeDevToken({ expiresIn: null })}` });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('F4: rejects a dev-token signed with the all-zero ENCRYPTION_KEY even in development', async () => {
      const zero = '0'.repeat(64);
      const guard = makeGuard(false, { NODE_ENV: 'development', ENCRYPTION_KEY: zero });
      const ctx = makeContext({ authHeader: `Bearer ${makeDevToken({ key: zero })}` });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('F4: rejects an expired dev-token in development', async () => {
      const guard = makeGuard(false, { NODE_ENV: 'development', ENCRYPTION_KEY: DEV_KEY });
      const expired = jwt.sign(
        { sub: 'attacker', exp: Math.floor(Date.now() / 1000) - 60 },
        DEV_KEY,
        { algorithm: 'HS256', issuer: 'music-os-360-dev' },
      );
      await expect(
        guard.canActivate(makeContext({ authHeader: `Bearer ${expired}` })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an HS256 dev-token when NODE_ENV=staging (must fall back to real JWKS verification and fail)', async () => {
      const guard = makeGuard(false, { NODE_ENV: 'staging', ENCRYPTION_KEY: DEV_KEY });
      const ctx = makeContext({ authHeader: `Bearer ${makeDevToken()}` });
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it.each(['Production', ' production ', 'STAGING', 'Staging'])(
      'rejects an HS256 dev-token when NODE_ENV=%j (case/whitespace variation must still be treated as prod-like -- CODEBASE_MAP Gotcha #9)',
      async (nodeEnv) => {
        const guard = makeGuard(false, { NODE_ENV: nodeEnv, ENCRYPTION_KEY: DEV_KEY });
        const ctx = makeContext({ authHeader: `Bearer ${makeDevToken()}` });
        await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      },
    );
  });

  describe('JWKS path claim/algorithm/kid validation', () => {
    const base = { sub: 'user-1', app_metadata: { org_id: 'org-1', role: 'admin' } };

    function sign(opts: { issuer?: string; audience?: string; keyid?: string | null }): string {
      const o: Record<string, unknown> = {
        algorithm: 'ES256',
        expiresIn: '1h',
        issuer: opts.issuer ?? 'https://test.supabase.co/auth/v1',
        audience: opts.audience ?? 'authenticated',
      };
      if (opts.keyid !== null) o['keyid'] = opts.keyid ?? 'test-kid';
      return jwt.sign(base, privateKey, o as jwt.SignOptions);
    }

    async function expectRejected(token: string): Promise<void> {
      const guard = makeGuard(false);
      await expect(
        guard.canActivate(makeContext({ authHeader: `Bearer ${token}` })),
      ).rejects.toThrow(UnauthorizedException);
    }

    it('control: a correctly issued token is accepted (proves the negatives below are not vacuous)', async () => {
      const guard = makeGuard(false);
      await expect(
        guard.canActivate(makeContext({ authHeader: `Bearer ${sign({})}` })),
      ).resolves.toBe(true);
    });

    it('rejects a wrong issuer', async () => {
      await expectRejected(sign({ issuer: 'https://evil.supabase.co/auth/v1' }));
    });

    it('rejects a wrong audience', async () => {
      await expectRejected(sign({ audience: 'service_role' }));
    });

    it('rejects an HS256 token (wrong alg) on the ES256/JWKS path, even with the right issuer/audience', async () => {
      const hs = jwt.sign(base, 'some-shared-secret-value', {
        algorithm: 'HS256',
        expiresIn: '1h',
        keyid: 'test-kid',
        issuer: 'https://test.supabase.co/auth/v1',
        audience: 'authenticated',
      });
      await expectRejected(hs);
    });

    it('rejects an HS256 token signed with the public key text (alg-confusion attempt)', async () => {
      const hs = jwt.sign(base, mockPublicKey.value, {
        algorithm: 'HS256',
        expiresIn: '1h',
        keyid: 'test-kid',
        issuer: 'https://test.supabase.co/auth/v1',
        audience: 'authenticated',
      });
      await expectRejected(hs);
    });

    it('rejects a token with no kid header', async () => {
      await expectRejected(sign({ keyid: null }));
    });

    it('rejects an alg=none token', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'test-kid' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ ...base, iss: 'https://test.supabase.co/auth/v1', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString('base64url');
      await expectRejected(`${header}.${payload}.`);
    });
  });
});
