import { ConfigService } from '@nestjs/config';
import { YouTubeArtistProfileProvider } from './youtube-artist-profile.provider';
import type { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';

function configWithKey(): ConfigService {
  return { get: () => 'fake-youtube-key' } as unknown as ConfigService;
}

function audience(subscribers: number, videos: number | null, views: number | null, observedAt = new Date('2026-08-19T00:00:00Z')) {
  return {
    subscribers: { value: subscribers, observedAt, source: 'soundcharts', endpoint: '/api/v2/artist/uuid-1/audience/youtube', field: 'items[].followerCount' },
    videos: videos === null ? null : { value: videos, observedAt, source: 'soundcharts', endpoint: '/api/v2/artist/uuid-1/audience/youtube', field: 'items[].postCount' },
    views: views === null ? null : { value: views, observedAt, source: 'soundcharts', endpoint: '/api/v2/artist/uuid-1/audience/youtube', field: 'items[].viewCount' },
  };
}

// "SOUNDCHARTS ONLY" RULE (2026-08-31 audit): subscribers, total_views and
// total_videos ALL come from a single Soundcharts call
// (getYouTubeAudience). The YouTube Data API global.fetch may only be called
// for IDENTITY RESOLUTION (handle/username/custom → channelId) — never
// for metrics. A "UC…" channelId is already the exact id: resolveChannelId does not even
// call fetch in that case, so fetchSpy must stay without calls throughout the
// suite below — the strongest possible proof that the metric does not depend
// on any external network outside Soundcharts.
describe('YouTubeArtistProfileProvider.resolve', () => {
  const channelId = 'UCabcdefghijklmnopqrstuv';
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('A) subscribers/total_views/total_videos ALL come from the same Soundcharts call — no YouTube Data API call', async () => {
    const soundcharts = {
      resolveArtistByPlatform: jest.fn().mockResolvedValue('uuid-1'),
      getYouTubeAudience: jest.fn().mockResolvedValue(audience(15400, 77, 123456)),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as SoundchartsService;
    const provider = new YouTubeArtistProfileProvider(configWithKey(), soundcharts);
    fetchSpy = jest.spyOn(global, 'fetch');

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: channelId,
      externalUrl: null,
    });

    expect(snapshot.subscribers).toBe(15400);
    expect(snapshot.total_views).toBe('123456');
    expect(snapshot.total_videos).toBe(77);
    expect(soundcharts.getYouTubeAudience).toHaveBeenCalledWith('uuid-1');
    expect((snapshot.raw_payload.views_videos_provenance as { source_provider: string }).source_provider).toBe('soundcharts');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('postCount/viewCount missing from Soundcharts: total_views/total_videos stay null (never filled from another API)', async () => {
    const soundcharts = {
      resolveArtistByPlatform: jest.fn().mockResolvedValue('uuid-1'),
      getYouTubeAudience: jest.fn().mockResolvedValue(audience(15400, null, null)),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as SoundchartsService;
    const provider = new YouTubeArtistProfileProvider(configWithKey(), soundcharts);
    fetchSpy = jest.spyOn(global, 'fetch');

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: channelId,
      externalUrl: null,
    });

    expect(snapshot.subscribers).toBe(15400);
    expect(snapshot.total_views).toBeNull();
    expect(snapshot.total_videos).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handle (@name) resolution calls the YouTube Data API ONLY for part=id — never part=statistics', async () => {
    const soundcharts = {
      resolveArtistByPlatform: jest.fn().mockResolvedValue('uuid-1'),
      getYouTubeAudience: jest.fn().mockResolvedValue(audience(15400, 77, 123456)),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as SoundchartsService;
    const provider = new YouTubeArtistProfileProvider(configWithKey(), soundcharts);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: channelId }] }),
    } as Response);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: '@musicos360',
      externalUrl: null,
    });

    expect(snapshot.subscribers).toBe(15400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const fetchedUrl = fetchSpy.mock.calls[0][0] as string;
    expect(fetchedUrl).toContain('part=id');
    expect(fetchedUrl).not.toContain('part=statistics');
    expect(fetchedUrl).not.toContain('statistics');
  });

  it('14) PHASE 1.3 — the own-handle UUID DIVERGES from the canonical (Spotify/Deezer): exact resolution by the registered channelId is still accepted; the divergence is only a diagnostic', async () => {
    const soundcharts = {
      resolveArtistByPlatform: jest.fn().mockResolvedValue('youtube-own-uuid'),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({ raw: {}, identifiers: [] }),
      getYouTubeAudience: jest.fn().mockResolvedValue(audience(555555, 10, 1000)),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as SoundchartsService;
    const provider = new YouTubeArtistProfileProvider(configWithKey(), soundcharts);
    fetchSpy = jest.spyOn(global, 'fetch');

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: channelId,
      externalUrl: null,
      canonicalUrls: {
        spotifyUrl: 'https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH',
        deezerUrl: 'https://www.deezer.com/artist/9635624',
      },
    });

    expect(soundcharts.getYouTubeAudience).toHaveBeenCalledWith('youtube-own-uuid');
    expect(snapshot.subscribers).toBe(555555);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
    expect(snapshot.raw_payload.cross_platform_status).toBe('CROSS_PLATFORM_DIVERGENT');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('find-4e35ea8e: channel resolved successfully (it really exists) but not indexed on Soundcharts (404): subscribers=null, sync_status=success (NEVER "failed")', async () => {
    const soundcharts = {
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      getYouTubeAudience: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as SoundchartsService;
    const provider = new YouTubeArtistProfileProvider(configWithKey(), soundcharts);
    fetchSpy = jest.spyOn(global, 'fetch');

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: channelId,
      externalUrl: null,
      canonicalUrls: {},
    });

    expect(soundcharts.getYouTubeAudience).not.toHaveBeenCalled();
    expect(snapshot.subscribers).toBeNull();
    expect(snapshot.total_views).toBeNull();
    expect(snapshot.total_videos).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.external_id).toBe(channelId);
  });

  it('a real Soundcharts error (not 404) during resolution propagates as a genuine failure (retry must happen)', async () => {
    const soundcharts = {
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new Error('Soundcharts 503: service unavailable')),
      getYouTubeAudience: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as SoundchartsService;
    const provider = new YouTubeArtistProfileProvider(configWithKey(), soundcharts);

    await expect(provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: channelId,
      externalUrl: null,
      canonicalUrls: {},
    })).rejects.toThrow('Soundcharts 503: service unavailable');
  });
});

describe('YouTubeArtistProfileProvider.parseRef', () => {
  const provider = new YouTubeArtistProfileProvider(new ConfigService(), {} as never);

  it('parses a /channel/UC… URL into a channel id', () => {
    expect(provider.parseRef('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'))
      .toEqual({ kind: 'id', value: 'UCabcdefghijklmnopqrstuv' });
  });

  it('parses a bare UC… id', () => {
    expect(provider.parseRef('UCabcdefghijklmnopqrstuv'))
      .toEqual({ kind: 'id', value: 'UCabcdefghijklmnopqrstuv' });
  });

  it('parses an @handle URL', () => {
    expect(provider.parseRef('https://youtube.com/@MusicOS360'))
      .toEqual({ kind: 'handle', value: 'MusicOS360' });
  });

  it('parses a bare @handle (no URL)', () => {
    expect(provider.parseRef('@MusicOS360'))
      .toEqual({ kind: 'handle', value: 'MusicOS360' });
  });

  it('parses a legacy /user/NAME URL', () => {
    expect(provider.parseRef('https://www.youtube.com/user/SomeArtist'))
      .toEqual({ kind: 'username', value: 'SomeArtist' });
  });

  it('parses a custom /c/NAME URL', () => {
    expect(provider.parseRef('https://www.youtube.com/c/SomeArtist'))
      .toEqual({ kind: 'custom', value: 'SomeArtist' });
  });

  it('parses a bare legacy custom name', () => {
    expect(provider.parseRef('https://www.youtube.com/SomeArtist'))
      .toEqual({ kind: 'custom', value: 'SomeArtist' });
  });

  it('handles trailing slashes and query strings', () => {
    expect(provider.parseRef('https://www.youtube.com/@MusicOS360/videos?x=1'))
      .toEqual({ kind: 'handle', value: 'MusicOS360' });
  });

  it('returns null for empty/invalid input', () => {
    expect(provider.parseRef('')).toBeNull();
    expect(provider.parseRef('   ')).toBeNull();
    expect(provider.parseRef(null as unknown as string)).toBeNull();
  });
});
