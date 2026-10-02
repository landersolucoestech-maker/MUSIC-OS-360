import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

const createMock = jest.fn();
jest.mock('@nestjs/core', () => ({ NestFactory: { create: (...a: unknown[]) => createMock(...a) } }));
jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));

import { assertApiRuntimeEnv, createApp } from './create-app';

const MANAGED = [
  'NODE_ENV', 'AUTH_DISABLED', 'USE_MOCK', 'MOCK_MODE', 'VITE_MOCK_MODE', 'DEV_AUTH_ENDPOINT_ENABLED',
  'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'DIRECT_DATABASE_URL', 'APP_DATABASE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
] as const;

const FLAGS = ['AUTH_DISABLED', 'USE_MOCK', 'MOCK_MODE', 'DEV_AUTH_ENDPOINT_ENABLED'] as const;

describe('assertApiRuntimeEnv / createApp — bypass flags are FATAL in prod-like environments', () => {
  const saved: Record<string, string | undefined> = {};
  let logger: Logger;

  beforeEach(() => {
    for (const k of MANAGED) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    // Otherwise-valid prod-like environment (non-Supabase hosts: no ref to cross-check).
    process.env.DATABASE_URL = 'postgres://app@db.internal.test:5432/app';
    process.env.SUPABASE_URL = 'https://auth.internal.test';
    process.env.SUPABASE_ANON_KEY = jwt.sign({ role: 'anon' }, 'unit-test-secret');
    createMock.mockReset();
    logger = new Logger('test');
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const k of MANAGED) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    jest.restoreAllMocks();
  });

  it('control: a clean production environment passes', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertApiRuntimeEnv(logger)).not.toThrow();
  });

  describe.each(['production', 'staging', ' Production '])('NODE_ENV=%j', (nodeEnv) => {
    it.each(FLAGS)('assertApiRuntimeEnv throws FATAL for %s=true', (flag) => {
      process.env.NODE_ENV = nodeEnv;
      process.env[flag] = 'true';
      expect(() => assertApiRuntimeEnv(logger)).toThrow(/^FATAL:.*\n.*forbidden/s);
      expect(() => assertApiRuntimeEnv(logger)).toThrow(`${flag}=true is forbidden`);
    });

    it.each(FLAGS)('createApp rejects for %s=true and never creates the Nest app', async (flag) => {
      process.env.NODE_ENV = nodeEnv;
      process.env[flag] = 'true';
      await expect(createApp()).rejects.toThrow(/FATAL/);
      expect(createMock).not.toHaveBeenCalled();
    });

    it.each(['MOCK_MODE', 'VITE_MOCK_MODE'])('createApp rejects for %s=true with a FATAL mock-mode error before creating the app', async (flag) => {
      process.env.NODE_ENV = nodeEnv;
      process.env[flag] = 'true';
      await expect(createApp()).rejects.toThrow(/FATAL/);
      expect(createMock).not.toHaveBeenCalled();
    });

    it('createApp rejects for VITE_MOCK_MODE=true specifically via the second guard', async () => {
      process.env.NODE_ENV = nodeEnv;
      process.env.VITE_MOCK_MODE = 'true';
      await expect(createApp()).rejects.toThrow(/MOCK_MODE=true is forbidden/);
    });
  });

  it('flag value other than exactly "true" is not treated as active (documents the exact-match contract)', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DISABLED = 'false';
    expect(() => assertApiRuntimeEnv(logger)).not.toThrow();
  });
});
