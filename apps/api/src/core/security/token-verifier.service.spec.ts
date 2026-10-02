import * as jwt from 'jsonwebtoken';
import { TokenVerifierService } from './token-verifier.service';
import { isInsecureDevSecret, verifyDevToken } from './dev-token';

const KEY = 'cd34'.repeat(16);
const ZERO = '0'.repeat(64);

function svc(env: Record<string, string | undefined>): TokenVerifierService {
  const config = { get: (k: string) => env[k] } as never;
  return new TokenVerifierService(config);
}

function sign(opts: { key?: string; exp?: boolean; issuer?: string; alg?: jwt.Algorithm } = {}): string {
  const o: jwt.SignOptions = { algorithm: opts.alg ?? 'HS256', issuer: opts.issuer ?? 'music-os-360-dev' };
  if (opts.exp !== false) o.expiresIn = '1h';
  return jwt.sign({ sub: 'dev-user' }, opts.key ?? KEY, o);
}

describe('TokenVerifierService.tryVerifyDevToken (F4 hardening)', () => {
  const devEnv = { NODE_ENV: 'development', ENCRYPTION_KEY: KEY };

  it('control: accepts an HS256 dev token with exp and a non-zero key in development', () => {
    expect(svc(devEnv).tryVerifyDevToken(sign())?.['sub']).toBe('dev-user');
  });

  it('rejects a dev token without an exp claim', () => {
    expect(svc(devEnv).tryVerifyDevToken(sign({ exp: false }))).toBeNull();
  });

  it('rejects the all-zero ENCRYPTION_KEY even when the token is signed with it', () => {
    expect(svc({ NODE_ENV: 'development', ENCRYPTION_KEY: ZERO }).tryVerifyDevToken(sign({ key: ZERO }))).toBeNull();
  });

  it('rejects when ENCRYPTION_KEY is missing', () => {
    expect(svc({ NODE_ENV: 'development' }).tryVerifyDevToken(sign())).toBeNull();
  });

  it('rejects a wrong issuer and a wrong signing key', () => {
    expect(svc(devEnv).tryVerifyDevToken(sign({ issuer: 'someone-else' }))).toBeNull();
    expect(svc(devEnv).tryVerifyDevToken(sign({ key: 'ef56'.repeat(16) }))).toBeNull();
  });

  it.each(['production', 'staging', ' Production ', 'STAGING'])(
    'never accepts a dev token when NODE_ENV=%j',
    (nodeEnv) => {
      expect(svc({ NODE_ENV: nodeEnv, ENCRYPTION_KEY: KEY }).tryVerifyDevToken(sign())).toBeNull();
    },
  );
});

describe('dev-token helpers', () => {
  it('isInsecureDevSecret flags empty and all-zero secrets only', () => {
    expect(isInsecureDevSecret(undefined)).toBe(true);
    expect(isInsecureDevSecret('')).toBe(true);
    expect(isInsecureDevSecret(ZERO)).toBe(true);
    expect(isInsecureDevSecret(KEY)).toBe(false);
  });

  it('verifyDevToken rejects an alg=none token', () => {
    const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ sub: 'x', iss: 'music-os-360-dev', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
    expect(verifyDevToken(`${h}.${p}.`, KEY)).toBeNull();
  });
});
