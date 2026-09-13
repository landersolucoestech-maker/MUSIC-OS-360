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

// REGRA "SOUNDCHARTS ONLY" (auditoria 2026-08-31): subscribers, total_views e
// total_videos vêm TODOS de uma única chamada Soundcharts
// (getYouTubeAudience). A YouTube Data API global.fetch só pode ser chamada
// para RESOLUÇÃO DE IDENTIDADE (handle/username/custom → channelId) — nunca
// para métrica. Um channelId "UC…" já é o id exato: resolveChannelId nem
// chama fetch nesse caso, então fetchSpy deve ficar sem chamadas em toda a
// suíte abaixo — a prova mais forte possível de que a métrica não depende
// de rede externa fora da Soundcharts.
describe('YouTubeArtistProfileProvider.resolve', () => {
  const channelId = 'UCabcdefghijklmnopqrstuv';
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('A) subscribers/total_views/total_videos vêm TODOS da mesma chamada Soundcharts — nenhuma chamada à YouTube Data API', async () => {
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

  it('postCount/viewCount ausentes na Soundcharts: total_views/total_videos ficam null (nunca preenchidos por outra API)', async () => {
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

  it('resolução por handle (@nome) chama a YouTube Data API SOMENTE para part=id — nunca part=statistics', async () => {
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

  it('14) FASE 1.3 — UUID do próprio handle DIVERGE do canônico (Spotify/Deezer): resolução exata pelo channelId cadastrado ainda é aceita; divergência vira só diagnóstico', async () => {
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

  it('find-4e35ea8e: canal resolvido com sucesso (existe de verdade) mas não indexado na Soundcharts (404): subscribers=null, sync_status=success (NUNCA "failed")', async () => {
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

  it('erro real da Soundcharts (não 404) durante a resolução propaga como falha genuína (retry deve acontecer)', async () => {
    const soundcharts = {
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new Error('Soundcharts 503: serviço indisponível')),
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
    })).rejects.toThrow('Soundcharts 503: serviço indisponível');
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
