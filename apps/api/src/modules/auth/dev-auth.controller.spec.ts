import 'reflect-metadata';
import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

const ORG = '10000000-0000-0000-0000-000000000002';
const signIn = jest.fn();
const updateUserById = jest.fn();
const createUser = jest.fn();
const createClientMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    createClientMock(...args);
    return { auth: { signInWithPassword: signIn, admin: { updateUserById, createUser } } };
  },
}));

import { DevAuthController } from './dev-auth.controller';

function controller(env: Record<string, string | undefined>): DevAuthController {
  const base: Record<string, string | undefined> = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    ENCRYPTION_KEY: 'ab12'.repeat(16),
    ...env,
  };
  const config = {
    get: (k: string) => base[k],
    getOrThrow: (k: string) => {
      if (!base[k]) throw new Error(`missing ${k}`);
      return base[k];
    },
  } as never;
  return new DevAuthController(config, null);
}

describe('DevAuthController GET /dev-auth/token', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    for (const k of ['DEV_AUTH_ENDPOINT_ENABLED', 'DEV_AUTH_EMAIL', 'DEV_AUTH_PASSWORD']) delete process.env[k];
    signIn.mockReset();
    updateUserById.mockReset().mockResolvedValue({ error: null });
    createUser.mockReset();
    createClientMock.mockReset();
  });
  afterAll(() => {
    process.env = saved;
  });

  const full = { DEV_AUTH_ENDPOINT_ENABLED: 'true', DEV_AUTH_EMAIL: 'dev@example.test', DEV_AUTH_PASSWORD: 'p-from-env' };

  describe('prod-like environments are always 403 (even with the opt-in flag and credentials)', () => {
    it.each(['production', 'staging', ' Production ', 'STAGING'])('NODE_ENV=%j', async (nodeEnv) => {
      await expect(controller({ NODE_ENV: nodeEnv, ...full }).token()).rejects.toThrow(ForbiddenException);
      expect(createClientMock).not.toHaveBeenCalled();
    });
  });

  describe('explicit opt-in (default OFF)', () => {
    it.each([undefined, 'false', '', 'TRUE', '1', 'yes'])(
      'DEV_AUTH_ENDPOINT_ENABLED=%j in development => 404 and no Supabase access',
      async (flag) => {
        const c = controller({ NODE_ENV: 'development', DEV_AUTH_ENDPOINT_ENABLED: flag, DEV_AUTH_EMAIL: 'a@b.test', DEV_AUTH_PASSWORD: 'x' });
        await expect(c.token()).rejects.toThrow(NotFoundException);
        expect(createClientMock).not.toHaveBeenCalled();
        expect(signIn).not.toHaveBeenCalled();
      },
    );

    it('NODE_ENV=test and unset NODE_ENV are also off by default', async () => {
      await expect(controller({ NODE_ENV: 'test' }).token()).rejects.toThrow(NotFoundException);
      await expect(controller({ NODE_ENV: undefined }).token()).rejects.toThrow(NotFoundException);
    });
  });

  describe('credentials come from env', () => {
    it.each([
      [{ DEV_AUTH_EMAIL: undefined, DEV_AUTH_PASSWORD: undefined }],
      [{ DEV_AUTH_EMAIL: 'dev@example.test', DEV_AUTH_PASSWORD: undefined }],
      [{ DEV_AUTH_EMAIL: undefined, DEV_AUTH_PASSWORD: 'x' }],
      [{ DEV_AUTH_EMAIL: '   ', DEV_AUTH_PASSWORD: 'x' }],
    ])('enabled without both credentials (%j) => clear 503 error, no Supabase access', async (creds) => {
      const c = controller({ NODE_ENV: 'development', DEV_AUTH_ENDPOINT_ENABLED: 'true', ...creds });
      const err = await c.token().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect((err as Error).message).toContain('DEV_AUTH_EMAIL');
      expect((err as Error).message).toContain('DEV_AUTH_PASSWORD');
      expect(createClientMock).not.toHaveBeenCalled();
    });

    it('enabled with credentials signs in with the env credentials, never the old hardcoded account', async () => {
      const supabaseToken = jwt.sign({ sub: 'u1', app_metadata: { org_id: ORG } }, 'irrelevant');
      signIn.mockResolvedValue({ data: { user: { id: 'u1' }, session: { access_token: supabaseToken } }, error: null });

      const result = await controller({ NODE_ENV: 'development', ...full }).token();

      expect(signIn).toHaveBeenCalled();
      for (const call of signIn.mock.calls) {
        expect(call[0]).toEqual({ email: 'dev@example.test', password: 'p-from-env' });
      }
      expect(JSON.stringify(result)).not.toContain('smoke-test@musicos360.dev');
      expect(result.user.email).toBe('dev@example.test');
      expect(result._dev).toBe(true);
    });
  });
  describe('upstream errors are not echoed to the client', () => {
    it('createUser failure returns a generic 403 and never the upstream message', async () => {
      signIn.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'invalid login' } });
      createUser.mockResolvedValue({ data: { user: null }, error: { message: 'UPSTREAM-DETAIL password policy rejected host=db.internal' } });
      const c = controller({ NODE_ENV: 'development', ...full });
      const err = await c.token().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(JSON.stringify((err as ForbiddenException).getResponse())).not.toMatch(/UPSTREAM-DETAIL|db\.internal|password policy/);
      expect((err as Error).message).toBe('Could not create dev user.');
    });
  });
});
