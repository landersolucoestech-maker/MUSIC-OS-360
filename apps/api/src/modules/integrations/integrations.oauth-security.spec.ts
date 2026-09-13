import { IntegrationsController } from './integrations.controller';

describe('IntegrationsController OAuth token boundary', () => {
  const buildController = () => {
    const cache = {
      get: jest.fn().mockReturnValue({
        platform: 'tiktok_business',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
      delete: jest.fn(),
      set: jest.fn(),
    };
    const integrationBase = {
      saveOAuthTokens: jest.fn().mockResolvedValue(undefined),
      getOAuthStatus: jest.fn().mockResolvedValue({ connected: true }),
      disconnectOAuth: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((key: string) => ({
        APP_URL: 'https://app.example.test',
        TIKTOK_CLIENT_KEY: 'client-key',
        TIKTOK_CLIENT_SECRET: 'client-secret',
      } as Record<string, string>)[key]),
    };

    const noop = {};
    const controller = new IntegrationsController(
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      noop as never,
      integrationBase as never,
      config as never,
      cache as never,
      noop as never,
    );

    return { controller, cache, integrationBase };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists TikTok tokens server-side and returns no credential', async () => {
    const { controller, integrationBase, cache } = buildController();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'browser-must-never-see-this',
        refresh_token: 'encrypted-server-side',
        expires_in: 3600,
        scope: 'user.info.basic,video.list',
      }),
    } as Response);

    const result = await controller.oauthExchange({
      code: 'authorization-code',
      platform: 'tiktok_business',
      exchange_token: 'single-use-token',
    });

    expect(result).toEqual({ connected: true, platform: 'tiktok_business' });
    expect(JSON.stringify(result)).not.toContain('browser-must-never-see-this');
    expect(cache.delete).toHaveBeenCalledWith('oauth_exchange:single-use-token');
    expect(integrationBase.saveOAuthTokens).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      provider: 'tiktok_business',
      accessToken: 'browser-must-never-see-this',
      refreshToken: 'encrypted-server-side',
      expiresIn: 3600,
      scopes: 'user.info.basic,video.list',
    });
  });

  it('uses the persisted provider alias for Spotify status and disconnect', async () => {
    const { controller, integrationBase } = buildController();
    const request = {
      tenant: { id: 'tenant-1' },
      auth: { userId: 'user-1' },
    };

    await controller.oauthStatus('corp_spotify', request);
    await controller.oauthDisconnect('spotify_ads', request);

    expect(integrationBase.getOAuthStatus).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'spotify',
    );
    expect(integrationBase.disconnectOAuth).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'spotify',
    );
  });
});
