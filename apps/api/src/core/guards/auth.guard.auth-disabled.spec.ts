/**
 * F1(b): JwtAuthGuard must reject a request without a token under a prod-like
 * NODE_ENV even when AUTH_DISABLED=true is requested. AUTH_DISABLED is evaluated at
 * module load, so each case loads the guard in an isolated module registry.
 *
 * This proves only that the dev bypass is fenced; it does NOT validate real authentication.
 */
import 'reflect-metadata';

// instanceof is not used: the isolated module registry loads its own copy of @nestjs/common.
jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));

type GuardCtor = typeof import('./auth.guard').JwtAuthGuard;

function loadGuardClass(env: { NODE_ENV?: string; AUTH_DISABLED?: string }): GuardCtor {
  const saved = { NODE_ENV: process.env.NODE_ENV, AUTH_DISABLED: process.env.AUTH_DISABLED };
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    if (env.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env.NODE_ENV;
    if (env.AUTH_DISABLED === undefined) delete process.env.AUTH_DISABLED;
    else process.env.AUTH_DISABLED = env.AUTH_DISABLED;

    let ctor!: GuardCtor;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ctor = require('./auth.guard').JwtAuthGuard;
    });
    return ctor;
  } finally {
    warn.mockRestore();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function makeContext(headers: Record<string, string> = {}) {
  const request: Record<string, unknown> = { headers };
  return {
    request,
    ctx: {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn().mockReturnValue(request) }),
    } as any,
  };
}

function makeGuard(Guard: GuardCtor, nodeEnv: string) {
  const config = {
    get: (key: string) => ({ SUPABASE_URL: 'https://test.supabase.co', NODE_ENV: nodeEnv })[key],
  } as any;
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as any;
  const guard = new Guard(config, reflector, undefined);
  guard.onModuleInit();
  return guard;
}

describe('JwtAuthGuard with AUTH_DISABLED=true requested', () => {
  it.each(['production', 'staging', ' Production ', 'Staging'])(
    'rejects a request without a token when NODE_ENV=%j',
    async (nodeEnv) => {
      const Guard = loadGuardClass({ NODE_ENV: nodeEnv, AUTH_DISABLED: 'true' });
      const guard = makeGuard(Guard, nodeEnv);
      const { ctx, request } = makeContext();
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 401, name: 'UnauthorizedException' });
      expect(request['auth']).toBeUndefined();
    },
  );

  it('rejects a request without a token when NODE_ENV=test', async () => {
    const Guard = loadGuardClass({ NODE_ENV: 'test', AUTH_DISABLED: 'true' });
    const guard = makeGuard(Guard, 'test');
    const { ctx } = makeContext();
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 401, name: 'UnauthorizedException' });
  });

  it('control: the bypass really is active only in exact development, so the denials above are not vacuous', async () => {
    const Guard = loadGuardClass({ NODE_ENV: 'development', AUTH_DISABLED: 'true' });
    const guard = makeGuard(Guard, 'development');
    const { ctx, request } = makeContext();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request['auth']).toBeDefined();
  });

  it('without AUTH_DISABLED, development also rejects a request without a token', async () => {
    const Guard = loadGuardClass({ NODE_ENV: 'development' });
    const guard = makeGuard(Guard, 'development');
    const { ctx } = makeContext();
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 401, name: 'UnauthorizedException' });
  });
});
