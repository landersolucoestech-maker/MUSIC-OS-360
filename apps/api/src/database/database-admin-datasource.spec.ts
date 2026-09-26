import { createAdminDataSource } from './database.module';

/**
 * P2-7 — proves the ADMIN_DATA_SOURCE factory always resolves its connection
 * from DATABASE_URL and never consults APP_DATABASE_URL or
 * DATABASE_SESSION_CONTEXT_ENABLED. Runs the standalone (no DATABASE_URL) path
 * so no real connection is opened.
 */
describe('createAdminDataSource — P2-7 owner-only enumeration connection', () => {
  function configSpy(values: Record<string, string | undefined>) {
    const requested: string[] = [];
    const config = {
      get: jest.fn((key: string) => { requested.push(key); return values[key]; }),
    };
    return { config: config as any, requested };
  }

  it('uses DATABASE_URL and ignores APP_DATABASE_URL and DATABASE_SESSION_CONTEXT_ENABLED', async () => {
    const { config, requested } = configSpy({
      NODE_ENV: 'development',
      DATABASE_URL: undefined,           // standalone → returns null before connecting
      APP_DATABASE_URL: 'postgres://app',
      DATABASE_SESSION_CONTEXT_ENABLED: 'true',
    });

    const ds = await createAdminDataSource(config);

    expect(ds).toBeNull();                                   // no DATABASE_URL → standalone
    expect(requested).toContain('DATABASE_URL');             // consults DATABASE_URL
    expect(requested).not.toContain('APP_DATABASE_URL');     // never reads APP_DATABASE_URL
    expect(requested).not.toContain('DATABASE_SESSION_CONTEXT_ENABLED'); // ignores the flag
  });

  it('in production without DATABASE_URL throws (does not fall back to APP_DATABASE_URL)', async () => {
    const { config, requested } = configSpy({
      NODE_ENV: 'production',
      DATABASE_URL: undefined,
      APP_DATABASE_URL: 'postgres://app',
      DATABASE_SESSION_CONTEXT_ENABLED: 'true',
    });

    await expect(createAdminDataSource(config)).rejects.toThrow('DATABASE_URL is required in production');
    expect(requested).not.toContain('APP_DATABASE_URL');
  });
});
