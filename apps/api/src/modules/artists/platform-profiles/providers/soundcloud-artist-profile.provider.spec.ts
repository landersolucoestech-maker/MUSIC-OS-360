import { SoundCloudArtistProfileProvider } from './soundcloud-artist-profile.provider';
import type { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';

const CANONICAL_URLS = {
  spotifyUrl: 'https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH',
  youtubeUrl: 'https://www.youtube.com/channel/UCiGm_E4ZwYSHV3bcW1pnSeQ',
};

describe('SoundCloudArtistProfileProvider.resolve (Metrics Phase 1 — protection against a same-name account)', () => {
  it('6) keeps persisting followers normally when the own-handle UUID matches the canonical one (healthy-path regression)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('artist-a-uuid'),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('artist-a-uuid'),
      getSoundCloudFollowers: jest.fn().mockResolvedValue({
        value: 53,
        observedAt: new Date('2026-08-30T00:00:00Z'),
        source: 'soundcharts',
        endpoint: '/api/v2/artist/artist-a-uuid/audience/soundcloud',
        field: 'items[].followerCount',
      }),
    } as unknown as SoundchartsService;
    const provider = new SoundCloudArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'dj-stay-real-handle',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(snapshot.followers).toBe(53);
    expect(snapshot.sync_status).toBe('success');
  });

  it('7) PHASE 1.3 — reproduction of the real DJ Stay bug: EXACT resolution by the registered slug (deejaystay) is never blocked just because another anchor (Spotify) resolves to a different Soundcharts entity (catalog fragmentation, not a registration error). The real metric of the registered account is accepted, with the divergence recorded as a diagnostic.', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      // EXACT by-platform resolution of the registered slug "deejaystay".
      resolveArtistByPlatform: jest.fn().mockResolvedValue('ceb88425-soundcloud-entity'),
      // The canonical chain (Spotify) resolves to a DIFFERENT Soundcharts entity
      // — same artist, but catalogued separately by Soundcharts itself.
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('11e81bc0-spotify-entity'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'soundcloud', identifier: 'djstay-sc' }],
      }),
      getSoundCloudFollowers: jest.fn().mockResolvedValue({
        value: 20775,
        observedAt: new Date(),
        source: 'soundcharts',
        endpoint: '/api/v2/artist/ceb88425-soundcloud-entity/audience/soundcloud',
        field: 'items[].followerCount',
      }),
    } as unknown as SoundchartsService;
    const provider = new SoundCloudArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'artist-a',
      externalId: 'deejaystay',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    // The metric of the EXACTLY registered account is fetched and persisted — never blocked.
    expect(soundcharts.getSoundCloudFollowers).toHaveBeenCalledWith('ceb88425-soundcloud-entity');
    expect(snapshot.followers).toBe(20775);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
    expect(snapshot.raw_payload.cross_platform_status).toBe('CROSS_PLATFORM_DIVERGENT');
    expect(snapshot.raw_payload.cross_platform_uuid).toBe('11e81bc0-spotify-entity');
    expect(snapshot.raw_payload.cross_platform_registry_identifier).toBe('djstay-sc');
  });

  it('8) with no other registered anchor (SoundCloud only): no data to cross-check, follows the normal path', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('only-soundcloud-uuid'),
      resolveCanonicalArtistUuid: jest.fn(),
      getSoundCloudFollowers: jest.fn().mockResolvedValue({
        value: 777,
        observedAt: new Date(),
        source: 'soundcharts',
        endpoint: '/x',
        field: 'y',
      }),
    } as unknown as SoundchartsService;
    const provider = new SoundCloudArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'solo-artist',
      externalUrl: null,
      canonicalUrls: {},
    });

    expect(soundcharts.resolveCanonicalArtistUuid).not.toHaveBeenCalled();
    expect(snapshot.followers).toBe(777);
    expect(snapshot.sync_status).toBe('success');
  });

  it('9) absent/invalid requested identifier → error before any resolution (a real PROFILE_NOT_FOUND is never confused with an identity mismatch)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new SoundCloudArtistProfileProvider(soundcharts);

    await expect(
      provider.resolve({
        tenantId: 't1',
        artistId: 'a1',
        externalId: null,
        externalUrl: 'https://not-soundcloud.com/x',
        canonicalUrls: CANONICAL_URLS,
      }),
    ).rejects.toThrow('SoundCloud profile slug missing or invalid');
    expect(soundcharts.resolveArtistByPlatform).not.toHaveBeenCalled();
  });

  it('10) with no other resolvable anchor: cross-platform evidence stays UNKNOWN, the metric is still persisted normally', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('uuid-x'),
      resolveCanonicalArtistUuid: jest.fn().mockRejectedValue(new Error('not found')),
      getSoundCloudFollowers: jest.fn().mockResolvedValue({
        value: 42, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y',
      }),
    } as unknown as SoundchartsService;
    const provider = new SoundCloudArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'deejaystay',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(snapshot.followers).toBe(42);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.cross_platform_status).toBe('CROSS_PLATFORM_UNKNOWN');
  });

  it('find-4e35ea8e: slug resolved successfully (it really exists) but not indexed on Soundcharts (404): followers=null, sync_status=success (NEVER "failed")', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      getSoundCloudFollowers: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new SoundCloudArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'deejaystay',
      externalUrl: null,
      canonicalUrls: {},
    });

    expect(soundcharts.getSoundCloudFollowers).not.toHaveBeenCalled();
    expect(snapshot.followers).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.external_id).toBe('deejaystay');
  });

  it('a real Soundcharts error (not 404) during resolution propagates as a genuine failure (retry must happen)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new Error('Soundcharts 503: service unavailable')),
      getSoundCloudFollowers: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new SoundCloudArtistProfileProvider(soundcharts);

    await expect(provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'deejaystay',
      externalUrl: null,
      canonicalUrls: {},
    })).rejects.toThrow('Soundcharts 503: service unavailable');
  });
});
