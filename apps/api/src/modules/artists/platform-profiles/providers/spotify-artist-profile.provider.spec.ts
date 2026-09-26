import { SpotifyArtistProfileProvider } from './spotify-artist-profile.provider';
import type { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';

const CANONICAL_URLS = {
  youtubeUrl: 'https://www.youtube.com/channel/UCiGm_E4ZwYSHV3bcW1pnSeQ',
  deezerUrl: 'https://www.deezer.com/artist/9635624',
};

describe('SpotifyArtistProfileProvider.resolve (Metrics Phase 1 — protection against a same-name account)', () => {
  it('10) the own-handle UUID matches the independent canonical: monthly_listeners is persisted normally', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('same-uuid'),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('same-uuid'),
      getSpotifyMonthlyListeners: jest.fn().mockResolvedValue({
        value: 100900,
        observedAt: new Date(),
        source: 'soundcharts',
        endpoint: '/x',
        field: 'y',
      }),
    } as unknown as SoundchartsService;
    const provider = new SpotifyArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: '6qqNVTkY8uBg9cP3Jd7DAH',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(snapshot.monthly_listeners).toBe(100900);
    expect(snapshot.sync_status).toBe('success');
  });

  it('11) PHASE 1.3 — the own-handle UUID DIVERGES from the canonical (YouTube/Deezer): exact resolution by the registered artistId is still accepted; the divergence is only a diagnostic', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('spotify-own-uuid'),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({ raw: {}, identifiers: [] }),
      getSpotifyMonthlyListeners: jest.fn().mockResolvedValue({ value: 999999, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
    } as unknown as SoundchartsService;
    const provider = new SpotifyArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'registered-id',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(soundcharts.getSpotifyMonthlyListeners).toHaveBeenCalledWith('spotify-own-uuid');
    expect(snapshot.monthly_listeners).toBe(999999);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
    expect(snapshot.raw_payload.cross_platform_status).toBe('CROSS_PLATFORM_DIVERGENT');
    expect(snapshot.raw_payload.cross_platform_uuid).toBe('canonical-uuid');
  });

  it('find-4e35ea8e: artistId resolved successfully (it really exists) but not indexed on Soundcharts (404): monthly_listeners=null, sync_status=success (NEVER "failed")', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      getSpotifyMonthlyListeners: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new SpotifyArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: '6qqNVTkY8uBg9cP3Jd7DAH',
      externalUrl: null,
      canonicalUrls: {},
    });

    expect(soundcharts.getSpotifyMonthlyListeners).not.toHaveBeenCalled();
    expect(snapshot.monthly_listeners).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.external_id).toBe('6qqNVTkY8uBg9cP3Jd7DAH');
  });

  it('a real Soundcharts error (not 404) during resolution propagates as a genuine failure (retry must happen)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new Error('Soundcharts 503: service unavailable')),
      getSpotifyMonthlyListeners: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new SpotifyArtistProfileProvider(soundcharts);

    await expect(provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: '6qqNVTkY8uBg9cP3Jd7DAH',
      externalUrl: null,
      canonicalUrls: {},
    })).rejects.toThrow('Soundcharts 503: service unavailable');
  });
});
