import { InstagramArtistProfileProvider } from './instagram-artist-profile.provider';
import { TikTokArtistProfileProvider } from './tiktok-artist-profile.provider';
import { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import { isDevMockSocialMetricsEnabled, mockFollowersFor } from '../dev-social-metrics-mock';

/**
 * Instagram/TikTok in dev/local: when Soundcharts genuinely has no
 * linked social account (a real 404 — confirmed against the API, see the comment
 * at the top of the providers), the card stayed "Indisponível" permanently,
 * even with valid credentials, because synthetic seed artists will never
 * be indexed in Soundcharts. With USE_MOCK=true (an existing flag,
 * already blocked in staging/production by env.schema.ts) outside
 * production/staging, a deterministic fallback fills the card for
 * layout demo/testing — always after the real data has been
 * tried and genuinely does not exist.
 */
function fakeSoundcharts(overrides: Partial<Record<keyof SoundchartsService, jest.Mock>> = {}) {
  return {
    isConfigured: jest.fn().mockReturnValue(true),
    resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found')),
    resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('sc-uuid-1'),
    ...overrides,
  } as unknown as SoundchartsService;
}

describe('isDevMockSocialMetricsEnabled', () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('false by default (USE_MOCK absent)', () => {
    delete process.env['USE_MOCK'];
    process.env['NODE_ENV'] = 'development';
    expect(isDevMockSocialMetricsEnabled()).toBe(false);
  });

  it('true only with USE_MOCK=true AND NODE_ENV=development', () => {
    process.env['USE_MOCK'] = 'true';
    process.env['NODE_ENV'] = 'development';
    expect(isDevMockSocialMetricsEnabled()).toBe(true);
  });

  it('never true in staging, even with USE_MOCK=true', () => {
    process.env['USE_MOCK'] = 'true';
    process.env['NODE_ENV'] = 'staging';
    expect(isDevMockSocialMetricsEnabled()).toBe(false);
  });

  it('never true in production, even with USE_MOCK=true', () => {
    process.env['USE_MOCK'] = 'true';
    process.env['NODE_ENV'] = 'production';
    expect(isDevMockSocialMetricsEnabled()).toBe(false);
  });
});

describe('mockFollowersFor', () => {
  it('is deterministic for the same (artistId, platform)', () => {
    expect(mockFollowersFor('artist-1', 'instagram')).toBe(mockFollowersFor('artist-1', 'instagram'));
  });

  it('never returns 0 and stays within a plausible range', () => {
    const v = mockFollowersFor('artist-1', 'tiktok');
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(200_000);
  });

  it('different artists tend to produce different values', () => {
    expect(mockFollowersFor('artist-1', 'instagram')).not.toBe(mockFollowersFor('artist-2', 'instagram'));
  });
});

describe('Instagram/TikTok provider — dev fallback when Soundcharts does not have the account', () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('Instagram: USE_MOCK=false keeps "Indisponível" (followers null) — real behavior preserved', async () => {
    delete process.env['USE_MOCK'];
    process.env['NODE_ENV'] = 'development';
    const getInstagramFollowers = jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found'));
    const soundcharts = fakeSoundcharts({ getInstagramFollowers });
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      externalId: 'djstay',
      externalUrl: null,
    });

    expect(snapshot.followers).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect((snapshot.raw_payload as Record<string, unknown>)['source']).toBe('soundcharts');
  });

  it('Instagram: USE_MOCK=true in dev fills followers with the fallback, flagged as dev_mock', async () => {
    process.env['USE_MOCK'] = 'true';
    process.env['NODE_ENV'] = 'development';
    const getInstagramFollowers = jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found'));
    const soundcharts = fakeSoundcharts({ getInstagramFollowers });
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      externalId: 'djstay',
      externalUrl: null,
    });

    expect(snapshot.followers).toBe(mockFollowersFor('artist-1', 'instagram'));
    expect(snapshot.sync_status).toBe('success');
    expect((snapshot.raw_payload as Record<string, unknown>)['source']).toBe('dev_mock');
  });

  it('Instagram: real Soundcharts data always wins over the mock, even with USE_MOCK=true', async () => {
    process.env['USE_MOCK'] = 'true';
    process.env['NODE_ENV'] = 'development';
    const getInstagramFollowers = jest.fn().mockResolvedValue({
      value: 124_221_841, observedAt: new Date('2026-08-18T00:00:00Z'), source: 'soundcharts' as const,
    });
    const soundcharts = fakeSoundcharts({ getInstagramFollowers });
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      externalId: 'billieeilish',
      externalUrl: null,
    });

    expect(snapshot.followers).toBe(124_221_841);
    expect((snapshot.raw_payload as Record<string, unknown>)['source']).toBe('soundcharts');
  });

  it('Instagram: USE_MOCK=true in production NEVER activates the fallback', async () => {
    process.env['USE_MOCK'] = 'true';
    process.env['NODE_ENV'] = 'production';
    const getInstagramFollowers = jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found'));
    const soundcharts = fakeSoundcharts({ getInstagramFollowers });
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      externalId: 'djstay',
      externalUrl: null,
    });

    expect(snapshot.followers).toBeNull();
    expect((snapshot.raw_payload as Record<string, unknown>)['source']).toBe('soundcharts');
  });

  it('TikTok: USE_MOCK=true in dev fills followers with the fallback, flagged as dev_mock', async () => {
    process.env['USE_MOCK'] = 'true';
    process.env['NODE_ENV'] = 'development';
    const getTikTokFollowers = jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found'));
    const soundcharts = fakeSoundcharts({ getTikTokFollowers });
    const provider = new TikTokArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      externalId: 'djstay',
      externalUrl: null,
    });

    expect(snapshot.followers).toBe(mockFollowersFor('artist-1', 'tiktok'));
    expect((snapshot.raw_payload as Record<string, unknown>)['source']).toBe('dev_mock');
  });
});
