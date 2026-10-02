/**
 * F1(a): the exported AUTH_DISABLED constant is true ONLY when AUTH_DISABLED=true AND
 * NODE_ENV is exactly 'development'. Evaluated at module load, hence jest.isolateModules.
 *
 * CURRENT DOCUMENTED BEHAVIOR (asserted explicitly, see core/auth-disabled.ts header):
 * an UNSET NODE_ENV defaults to 'development' at runtime, so AUTH_DISABLED=true is honored
 * there. That is a local-use convenience; the release gate `verify:production-flags` fails
 * on an unset NODE_ENV instead.
 */
function loadAuthDisabled(env: { NODE_ENV?: string; AUTH_DISABLED?: string }): boolean {
  const saved = { NODE_ENV: process.env.NODE_ENV, AUTH_DISABLED: process.env.AUTH_DISABLED };
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    if (env.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env.NODE_ENV;
    if (env.AUTH_DISABLED === undefined) delete process.env.AUTH_DISABLED;
    else process.env.AUTH_DISABLED = env.AUTH_DISABLED;

    let value!: boolean;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      value = require('./auth-disabled').AUTH_DISABLED;
    });
    return value;
  } finally {
    warn.mockRestore();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('AUTH_DISABLED constant', () => {
  it.each(['production', 'staging', 'test', 'Development', ' development', 'development ', 'DEVELOPMENT', 'Production', ' Production ', ''])(
    'is false for NODE_ENV=%j even with AUTH_DISABLED=true',
    (nodeEnv) => {
      expect(loadAuthDisabled({ NODE_ENV: nodeEnv, AUTH_DISABLED: 'true' })).toBe(false);
    },
  );

  it('is true only for exactly NODE_ENV=development with AUTH_DISABLED=true', () => {
    expect(loadAuthDisabled({ NODE_ENV: 'development', AUTH_DISABLED: 'true' })).toBe(true);
  });

  it.each([undefined, 'false', 'TRUE', '1', 'yes', ' true'])(
    'is false in development unless AUTH_DISABLED is exactly "true" (got %j)',
    (flag) => {
      expect(loadAuthDisabled({ NODE_ENV: 'development', AUTH_DISABLED: flag })).toBe(false);
    },
  );

  it('documents current behavior: unset NODE_ENV defaults to development, so the flag IS honored (release gate fails on unset NODE_ENV instead)', () => {
    expect(loadAuthDisabled({ NODE_ENV: undefined, AUTH_DISABLED: 'true' })).toBe(true);
    expect(loadAuthDisabled({ NODE_ENV: undefined })).toBe(false);
  });
});
