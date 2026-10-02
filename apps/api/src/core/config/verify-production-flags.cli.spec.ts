/**
 * F5: dry-run of the real release-gate script (scripts/verify-production-flags.ts) in a
 * child process with an explicit, minimal environment. Proves the CLI exits non-zero when a
 * bypass flag is true in a production-like environment and when NODE_ENV is unset.
 * Flag values/secrets are never printed by the script; these tests use dummy values only.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const API_ROOT = resolve(__dirname, '../../..');
const TSX = resolve(API_ROOT, 'node_modules/.bin/tsx');

function run(env: Record<string, string>) {
  return spawnSync(TSX, ['scripts/verify-production-flags.ts'], {
    cwd: API_ROOT,
    // Explicit minimal env: NODE_ENV is only present when the case sets it.
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    encoding: 'utf8',
    timeout: 60_000,
  });
}

const VALID_AUTHORITY = {
  DATABASE_SESSION_CONTEXT_ENABLED: 'true',
  APP_DATABASE_URL: 'postgres://app@db.internal.test/app',
  RBAC_PERSISTED_AUTHORITY: 'ON',
};

describe('verify:production-flags CLI', () => {
  jest.setTimeout(90_000);

  it('control: production with valid authority flags and no bypass flags exits 0', () => {
    const r = run({ NODE_ENV: 'production', ...VALID_AUTHORITY });
    expect(r.status).toBe(0);
  });

  it.each(['AUTH_DISABLED', 'USE_MOCK', 'MOCK_MODE', 'DEV_AUTH_ENDPOINT_ENABLED'])(
    'production with %s=true exits 1 and names the flag',
    (flag) => {
      const r = run({ NODE_ENV: 'production', ...VALID_AUTHORITY, [flag]: 'true' });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(`${flag}=true`);
    },
  );

  it('staging with AUTH_DISABLED=true exits 1', () => {
    const r = run({ NODE_ENV: 'staging', ...VALID_AUTHORITY, AUTH_DISABLED: 'true' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('AUTH_DISABLED=true');
  });

  it('an unset NODE_ENV exits 1 (even though the runtime defaults it to development)', () => {
    const r = run({});
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('NODE_ENV is not set');
  });

  it("' Production ' (non-canonical) exits 1", () => {
    const r = run({ NODE_ENV: ' Production ', ...VALID_AUTHORITY });
    expect(r.status).toBe(1);
  });

  it('development with the flags set exits 0 (local use is not blocked by the release gate)', () => {
    const r = run({ NODE_ENV: 'development', AUTH_DISABLED: 'true' });
    expect(r.status).toBe(0);
  });
});
