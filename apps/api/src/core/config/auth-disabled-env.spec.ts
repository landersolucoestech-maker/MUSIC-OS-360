/**
 * Part 76 — AUTH_DISABLED must never escape development.
 * The code already blocked this (envSchema.superRefine + create-app.ts), but
 * there was no test covering the rule — it was only discovered through
 * manual inspection during this Part.
 */
import { envSchema } from './env.schema';

function issuePaths(result: ReturnType<typeof envSchema.safeParse>): string[] {
  if (result.success) return [];
  return result.error.issues.map((i) => i.path.join('.'));
}

describe('envSchema — AUTH_DISABLED/USE_MOCK/MOCK_MODE forbidden outside development', () => {
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

  it('USE_MOCK/MOCK_MODE follow the same rule as AUTH_DISABLED', () => {
    const staging = envSchema.safeParse({ NODE_ENV: 'staging', USE_MOCK: 'true', MOCK_MODE: 'true' });
    const paths = issuePaths(staging);
    expect(paths).toContain('USE_MOCK');
    expect(paths).toContain('MOCK_MODE');
  });
});
