import { Logger } from '@nestjs/common';
import { SecurityStartupService } from './security-startup.service';
import { PROD_FORBIDDEN_BYPASS_FLAGS } from '../config/env.schema';

const KEY = 'ab12'.repeat(16);

function service(env: Record<string, string | undefined>): SecurityStartupService {
  return new SecurityStartupService({ get: (k: string) => env[k] } as never);
}

const CLEAN_PROD = {
  NODE_ENV: 'production',
  ENCRYPTION_KEY: KEY,
  SUPABASE_URL: 'https://auth.internal.test',
  DATABASE_URL: 'postgres://db.internal.test/app',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SENTRY_DSN: 'https://sentry.internal.test/1',
  METRICS_TOKEN: 'metrics-token',
};

describe('SecurityStartupService — bypass flags schedule process termination in prod-like envs', () => {
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    // Never really exit: process.exit is replaced for every test.
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('control: a clean production configuration does not schedule an exit', () => {
    service(CLEAN_PROD).onApplicationBootstrap();
    jest.advanceTimersByTime(1000);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  describe.each(['production', 'staging', ' Production ', 'STAGING'])('NODE_ENV=%j', (nodeEnv) => {
    it.each([...PROD_FORBIDDEN_BYPASS_FLAGS])(
      '%s=true schedules process.exit(1)',
      (flag) => {
        service({ ...CLEAN_PROD, NODE_ENV: nodeEnv, [flag]: 'true' }).onApplicationBootstrap();
        expect(exitSpy).not.toHaveBeenCalled(); // deferred by 200ms, not immediate
        jest.advanceTimersByTime(250);
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain('FATAL SECURITY');
      },
    );
  });

  it('development with AUTH_DISABLED=true only warns (no exit)', () => {
    service({ NODE_ENV: 'development', ENCRYPTION_KEY: KEY, SUPABASE_URL: 'http://localhost:54321', AUTH_DISABLED: 'true' }).onApplicationBootstrap();
    jest.advanceTimersByTime(1000);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
