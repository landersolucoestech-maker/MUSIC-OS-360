/**
 * Part 76 — AUTH_DISABLED must never escape development.
 * The code already blocked this (envSchema.superRefine + create-app.ts), but
 * there was no test covering the rule — it was only discovered through
 * manual inspection during this Part.
 */
import { collectProductionBypassFlagErrors, envSchema, PROD_FORBIDDEN_BYPASS_FLAGS } from './env.schema';

function issuePaths(result: ReturnType<typeof envSchema.safeParse>): string[] {
  if (result.success) return [];
  return result.error.issues.map((i) => i.path.join('.'));
}

describe('envSchema — AUTH_DISABLED/USE_MOCK/DEV_SOCIAL_METRICS_MOCK forbidden outside development', () => {
  it('AUTH_DISABLED=true in development does not raise an issue', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'development', AUTH_DISABLED: 'true' });
    expect(issuePaths(result)).not.toContain('AUTH_DISABLED');
  });

  it('AUTH_DISABLED=true in staging raises an explicit issue', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'staging', AUTH_DISABLED: 'true' });
    expect(issuePaths(result)).toContain('AUTH_DISABLED');
  });

  it('AUTH_DISABLED=true in production raises an explicit issue', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'production', AUTH_DISABLED: 'true' });
    expect(issuePaths(result)).toContain('AUTH_DISABLED');
  });

  it('AUTH_DISABLED absent/false never raises an issue, in any environment', () => {
    for (const NODE_ENV of ['development', 'staging', 'production'] as const) {
      expect(issuePaths(envSchema.safeParse({ NODE_ENV }))).not.toContain('AUTH_DISABLED');
      expect(issuePaths(envSchema.safeParse({ NODE_ENV, AUTH_DISABLED: 'false' }))).not.toContain('AUTH_DISABLED');
    }
  });

  it('USE_MOCK (deprecated alias) and DEV_SOCIAL_METRICS_MOCK follow the same rule as AUTH_DISABLED', () => {
    const staging = envSchema.safeParse({ NODE_ENV: 'staging', USE_MOCK: 'true', DEV_SOCIAL_METRICS_MOCK: 'true' });
    const paths = issuePaths(staging);
    expect(paths).toContain('USE_MOCK');
    expect(paths).toContain('DEV_SOCIAL_METRICS_MOCK');
  });

  it('MOCK_MODE is a removed dead flag: no schema key, no prod-forbid entry', () => {
    expect(PROD_FORBIDDEN_BYPASS_FLAGS).not.toContain('MOCK_MODE' as never);
  });

  it('DEV_TENANT_ID / DEV_ORG_ID must be UUIDs when set', () => {
    const uuid = '00000000-0000-4000-8000-000000000001';
    expect(issuePaths(envSchema.safeParse({ NODE_ENV: 'development', DEV_TENANT_ID: uuid, DEV_ORG_ID: uuid }))).toEqual([]);
    const bad = issuePaths(envSchema.safeParse({ NODE_ENV: 'development', DEV_TENANT_ID: 'nope', DEV_ORG_ID: '123' }));
    expect(bad).toContain('DEV_TENANT_ID');
    expect(bad).toContain('DEV_ORG_ID');
  });
});

describe('envSchema — DEV_AUTH_ENDPOINT_ENABLED (F2) follows the bypass-flag rule', () => {
  it('is optional: absent never raises an issue in any environment', () => {
    for (const NODE_ENV of ['development', 'test', 'staging', 'production'] as const) {
      expect(issuePaths(envSchema.safeParse({ NODE_ENV }))).not.toContain('DEV_AUTH_ENDPOINT_ENABLED');
    }
  });

  it('true in development is accepted with optional DEV_AUTH_EMAIL/DEV_AUTH_PASSWORD', () => {
    const result = envSchema.safeParse({
      NODE_ENV: 'development',
      DEV_AUTH_ENDPOINT_ENABLED: 'true',
      DEV_AUTH_EMAIL: 'dev@example.test',
      DEV_AUTH_PASSWORD: 'x',
    });
    expect(issuePaths(result)).not.toContain('DEV_AUTH_ENDPOINT_ENABLED');
  });

  it.each(['staging', 'production'] as const)('true in %s is rejected', (NODE_ENV) => {
    expect(issuePaths(envSchema.safeParse({ NODE_ENV, DEV_AUTH_ENDPOINT_ENABLED: 'true' }))).toContain(
      'DEV_AUTH_ENDPOINT_ENABLED',
    );
  });
});

describe('collectProductionBypassFlagErrors (verify:production-flags, F5)', () => {
  const FLAGS = [...PROD_FORBIDDEN_BYPASS_FLAGS];

  it.each(['production', 'staging'])('control: clean %s passes', (NODE_ENV) => {
    expect(collectProductionBypassFlagErrors({ NODE_ENV })).toEqual([]);
  });

  it.each(['development', 'test'])('control: %s with bypass flags set is allowed (local use)', (NODE_ENV) => {
    expect(collectProductionBypassFlagErrors({ NODE_ENV, AUTH_DISABLED: 'true', USE_MOCK: 'true' })).toEqual([]);
  });

  describe.each(['production', 'staging'])('NODE_ENV=%s', (NODE_ENV) => {
    it.each(FLAGS)('%s=true fails', (flag) => {
      const errors = collectProductionBypassFlagErrors({ NODE_ENV, [flag]: 'true' });
      expect(errors.some((e) => e.startsWith(`${flag}=true`))).toBe(true);
    });
  });

  it('an unset or blank NODE_ENV is a failure', () => {
    expect(collectProductionBypassFlagErrors({}).join('\n')).toMatch(/NODE_ENV is not set/);
    expect(collectProductionBypassFlagErrors({ NODE_ENV: '  ' }).join('\n')).toMatch(/NODE_ENV is not set/);
  });

  it('an unset NODE_ENV with AUTH_DISABLED=true also reports the flag (unproven environment)', () => {
    const errors = collectProductionBypassFlagErrors({ AUTH_DISABLED: 'true' });
    expect(errors.some((e) => e.startsWith('AUTH_DISABLED=true'))).toBe(true);
  });

  it.each([' Production ', 'Production', 'prod', 'STAGING'])('non-canonical NODE_ENV %j is a failure and flags still fail', (NODE_ENV) => {
    const errors = collectProductionBypassFlagErrors({ NODE_ENV, AUTH_DISABLED: 'true' });
    expect(errors.join('\n')).toMatch(/not exactly one of/);
    expect(errors.some((e) => e.startsWith('AUTH_DISABLED=true'))).toBe(true);
  });
});
