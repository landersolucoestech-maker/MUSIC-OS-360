import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DevAuthConfigError,
  assertDevAuthFlags,
  assertDevAuthPreconditions,
  assertDevAuthTarget,
} from './dev-auth-guard';

const GOOD = {
  DEV_AUTH_ENDPOINT_ENABLED: 'true',
  DEV_AUTH_EMAIL: 'dev-owner@example.test',
  DEV_AUTH_PASSWORD: 'throwaway-not-a-secret',
};

describe('dev-auth-guard flags', () => {
  it('accepts an explicit, complete declaration', () => {
    expect(() => assertDevAuthFlags('t', GOOD)).not.toThrow();
  });

  it('fails when nothing is declared (no implicit bypass)', () => {
    expect(() => assertDevAuthFlags('t', {})).toThrow(DevAuthConfigError);
    expect(() => assertDevAuthFlags('t', {})).toThrow(/DEV_AUTH_ENDPOINT_ENABLED is missing/);
  });

  it.each(['false', '1', 'TRUE', 'yes', ' true'])('rejects incorrect enable value %p', (value) => {
    expect(() => assertDevAuthFlags('t', { ...GOOD, DEV_AUTH_ENDPOINT_ENABLED: value })).toThrow(/incorrect value/);
  });

  it('requires email and password and never echoes their values', () => {
    expect(() => assertDevAuthFlags('t', { ...GOOD, DEV_AUTH_EMAIL: '  ' })).toThrow(/DEV_AUTH_EMAIL is missing/);
    expect(() => assertDevAuthFlags('t', { ...GOOD, DEV_AUTH_PASSWORD: '' })).toThrow(/DEV_AUTH_PASSWORD is missing/);
    try {
      assertDevAuthFlags('t', { ...GOOD, DEV_AUTH_ENDPOINT_ENABLED: 'nope' });
    } catch (e) {
      expect((e as Error).message).not.toContain(GOOD.DEV_AUTH_PASSWORD);
      expect((e as Error).message).not.toContain(GOOD.DEV_AUTH_EMAIL);
    }
  });
});

describe('dev-auth-guard target', () => {
  it.each(['http://localhost:3001', 'http://127.0.0.1:3001/api/v1', 'http://[::1]:3001'])('allows loopback %s', (u) => {
    expect(() => assertDevAuthTarget('t', u, {})).not.toThrow();
  });

  it.each([
    'https://api.musicos360.com',
    'https://staging.example.com/api/v1',
    'http://localhost.evil.com',
    'http://localhost@evil.com',
    'http://10.0.0.5:3001',
    'ftp://localhost',
    'not a url',
    '',
  ])('refuses non-local or malformed target %p', (u) => {
    expect(() => assertDevAuthTarget('t', u, {})).toThrow(DevAuthConfigError);
  });

  it.each(['production', 'staging', ' Production '])('refuses NODE_ENV=%p even for localhost', (nodeEnv) => {
    expect(() => assertDevAuthTarget('t', 'http://localhost:3001', { NODE_ENV: nodeEnv })).toThrow(/production-like/);
  });

  it('preconditions require both target and flags', () => {
    expect(() => assertDevAuthPreconditions('t', 'http://localhost:3001', GOOD)).not.toThrow();
    expect(() => assertDevAuthPreconditions('t', 'http://localhost:3001', {})).toThrow(/not explicitly configured/);
    expect(() => assertDevAuthPreconditions('t', 'https://prod.example.com', GOOD)).toThrow(/non-local/);
  });
});

describe('the four dev-auth scripts are wired to the guard', () => {
  const dir = join(__dirname, '..');
  const scripts = ['smoke-test.ts', 'verify-phase8-resilience.ts', 'verify-phase7d-upload.ts', 'reports-smoke.ts'];
  it.each(scripts)('%s imports the guard and calls it as a precondition', (file) => {
    const src = readFileSync(join(dir, file), 'utf8');
    expect(src).toMatch(/import \{ assertDevAuthPreconditions \} from '\.\/lib\/dev-auth-guard';/);
    expect(src).toMatch(/\bassertDevAuthPreconditions\('[a-z0-9-]+', /);
    expect(src).toMatch(/['"`]\/dev-auth\/token['"`]/);
  });

  it('smoke-test no longer downgrades dev-auth failures to a warning/skip', () => {
    const src = readFileSync(join(dir, 'smoke-test.ts'), 'utf8');
    expect(src).not.toMatch(/bootstrapAuth failed/);
    expect(src).not.toMatch(/Authenticated checks will be skipped/);
    expect(src).toMatch(/SMOKE_PUBLIC_ONLY/);
  });
});
