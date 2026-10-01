import type { ConfigService } from '@nestjs/config';
import { SoundchartsService } from '../../integrations/soundcharts/soundcharts.service';
import {
  buildCanonicalCandidates,
  checkRegisteredHandleAgainstRegistry,
  evaluateCrossPlatformEvidence,
  resolveCanonicalUuidForProvider,
} from './soundcharts-canonical-candidates.util';

const fakeConfig = { get: jest.fn() } as unknown as ConfigService;

const URLS = {
  spotifyUrl: 'https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH',
  youtubeUrl: 'https://www.youtube.com/channel/UCiGm_E4ZwYSHV3bcW1pnSeQ',
  deezerUrl: 'https://www.deezer.com/artist/9635624',
  soundcloudUrl: 'https://soundcloud.com/billieeilish',
};

describe('buildCanonicalCandidates', () => {
  it('extracts each platform\'s id in the order spotify → youtube → deezer → soundcloud', () => {
    expect(buildCanonicalCandidates(URLS)).toEqual([
      { platform: 'spotify', externalId: '6qqNVTkY8uBg9cP3Jd7DAH' },
      { platform: 'youtube', externalId: 'UCiGm_E4ZwYSHV3bcW1pnSeQ' },
      { platform: 'deezer', externalId: '9635624' },
      { platform: 'soundcloud', externalId: 'billieeilish' },
    ]);
  });

  it('externalId is null when the platform URL is absent', () => {
    expect(buildCanonicalCandidates({})).toEqual([
      { platform: 'spotify', externalId: null },
      { platform: 'youtube', externalId: null },
      { platform: 'deezer', externalId: null },
      { platform: 'soundcloud', externalId: null },
    ]);
  });
});

describe('evaluateCrossPlatformEvidence (Phase 1.3 — purely diagnostic, never blocks)', () => {
  it('1) CROSS_PLATFORM_UNKNOWN when no other anchor is registered — nothing to compare', async () => {
    const soundcharts = { resolveCanonicalArtistUuid: jest.fn() } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, {}, 'soundcloud', 'own-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_UNKNOWN', independentUuid: null, registryIdentifier: null });
    expect(soundcharts.resolveCanonicalArtistUuid).not.toHaveBeenCalled();
  });

  it('2) CROSS_PLATFORM_CONSISTENT when the independent UUID MATCHES the UUID resolved from the platform\'s own handle', async () => {
    const soundcharts = {
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('same-uuid'),
    } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'same-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_CONSISTENT', independentUuid: 'same-uuid', registryIdentifier: null });
  });

  it('3) CROSS_PLATFORM_DIVERGENT when the independent UUID DIVERGES from the UUID resolved from the own handle — no registry available', async () => {
    const soundcharts = {
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid-artist-a'),
      getArtistIdentifiers: jest.fn().mockRejectedValue(new Error('not found')),
    } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'own-resolved-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_DIVERGENT', independentUuid: 'canonical-uuid-artist-a', registryIdentifier: null });
  });

  it('3b) on divergence, looks up this platform\'s identifier in the canonical registry as evidence (real finding: registered SoundCloud "deejaystay" vs. "djstay-sc" in the canonical registry — diagnostic only, never applied)', async () => {
    const soundcharts = {
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid-artist-a'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [
          { platform: 'spotify', identifier: 'abc123' },
          { platform: 'soundcloud', identifier: 'djstay-sc' },
        ],
      }),
    } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'own-resolved-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_DIVERGENT', independentUuid: 'canonical-uuid-artist-a', registryIdentifier: 'djstay-sc' });
    expect(soundcharts.getArtistIdentifiers).toHaveBeenCalledWith('canonical-uuid-artist-a');
  });

  it('4) CROSS_PLATFORM_UNKNOWN when other anchors exist but none resolves on Soundcharts', async () => {
    const soundcharts = {
      resolveCanonicalArtistUuid: jest.fn().mockRejectedValue(new Error('not found')),
    } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'own-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_UNKNOWN', independentUuid: null, registryIdentifier: null });
  });

  it('5) never includes the platform under verification among the independent candidates (avoids tautology)', async () => {
    const resolveCanonicalArtistUuid = jest.fn().mockResolvedValue('x');
    const soundcharts = { resolveCanonicalArtistUuid } as unknown as SoundchartsService;

    await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'x');

    const candidates = resolveCanonicalArtistUuid.mock.calls[0][0] as Array<{ platform: string }>;
    expect(candidates.some((c) => c.platform === 'soundcloud')).toBe(false);
    expect(candidates.map((c) => c.platform)).toEqual(['spotify', 'youtube', 'deezer']);
  });
});

describe('checkRegisteredHandleAgainstRegistry (Phase 1.3 — secondary fallback evidence)', () => {
  it('CONFIRMED when the canonical registry lists exactly the registered handle', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'instagram', identifier: 'djstayofc' }],
      }),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('CONFIRMED');
  });

  it('comparison is case-insensitive', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'instagram', identifier: 'DjStayOfc' }],
      }),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('CONFIRMED');
  });

  it('MISMATCH when the registry lists an identifier DIFFERENT from the registered one', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'instagram', identifier: 'other-account' }],
      }),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('MISMATCH');
  });

  it('INSUFFICIENT_EVIDENCE when the registry does not list this platform — missing data never becomes CONFIRMED', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'spotify', identifier: 'abc123' }],
      }),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('INSUFFICIENT_EVIDENCE when the registry lookup fails — unavailability never becomes CONFIRMED', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockRejectedValue(new Error('timeout')),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('INSUFFICIENT_EVIDENCE');
  });
});

describe('resolveCanonicalUuidForProvider — cross-platform UUID reuse (Soundcharts 06)', () => {
  it('Spotify resolves the UUID → Instagram reuses it without querying YouTube/Deezer/SoundCloud/own handle', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      if (platform === 'spotify') return 'sc-uuid-1';
      throw new Error(`should not query ${platform}`);
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'instagram', 'billieeilish');

    expect(uuid).toBe('sc-uuid-1');
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledTimes(1);
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('spotify', '6qqNVTkY8uBg9cP3Jd7DAH');
  });

  it('Spotify resolves the UUID → TikTok reuses it without querying its own handle', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      if (platform === 'spotify') return 'sc-uuid-1';
      throw new Error(`should not query ${platform}`);
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'tiktok', 'billieeilish');

    expect(uuid).toBe('sc-uuid-1');
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledTimes(1);
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('spotify', '6qqNVTkY8uBg9cP3Jd7DAH');
  });

  it('Spotify fails → YouTube resolves (Deezer/SoundCloud/own handle are not queried)', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    const attempted: string[] = [];
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      attempted.push(platform);
      if (platform === 'spotify') throw new Error('not found');
      if (platform === 'youtube') return 'sc-uuid-2';
      throw new Error(`should not query ${platform}`);
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'instagram', 'billieeilish');

    expect(uuid).toBe('sc-uuid-2');
    expect(attempted).toEqual(['spotify', 'youtube']);
  });

  it('Spotify and YouTube fail → Deezer resolves (SoundCloud/own handle are not queried)', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    const attempted: string[] = [];
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      attempted.push(platform);
      if (platform === 'deezer') return 'sc-uuid-3';
      throw new Error('not found');
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'tiktok', 'billieeilish');

    expect(uuid).toBe('sc-uuid-3');
    expect(attempted).toEqual(['spotify', 'youtube', 'deezer']);
  });

  it('all 4 canonical platforms fail → ownPlatform (own handle) is the final fallback', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    const attempted: string[] = [];
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      attempted.push(platform);
      if (platform === 'instagram') return 'sc-uuid-own';
      throw new Error('not found');
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'instagram', 'billieeilish');

    expect(uuid).toBe('sc-uuid-own');
    expect(attempted).toEqual(['spotify', 'youtube', 'deezer', 'soundcloud', 'instagram']);
  });

  it('with no canonical URL registered, resolves directly from the own handle', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      if (platform === 'tiktok') return 'sc-uuid-own';
      throw new Error(`should not query ${platform}`);
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, undefined, 'tiktok', 'billieeilish');

    expect(uuid).toBe('sc-uuid-own');
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledTimes(1);
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('tiktok', 'billieeilish');
  });

  it('every attempt (including ownPlatform) fails → aggregated error, no invented UUID', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    soundcharts.resolveArtistByPlatform = jest.fn(async () => { throw new Error('not found'); }) as never;

    await expect(
      resolveCanonicalUuidForProvider(soundcharts, URLS, 'instagram', 'billieeilish'),
    ).rejects.toThrow(/could not resolve the artist/);
  });
});
