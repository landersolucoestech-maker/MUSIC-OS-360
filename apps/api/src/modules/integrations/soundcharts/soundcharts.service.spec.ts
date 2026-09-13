import type { ConfigService } from '@nestjs/config';
import { SoundchartsService } from './soundcharts.service';
import {
  SoundchartsNotConfiguredError,
  SoundchartsNotFoundError,
  SoundchartsRateLimitError,
} from './soundcharts.errors';

const TOKEN_URL = 'https://account.soundcharts.com/oauth/token';

function tokenResponse(overrides: Partial<{ access_token: string; expires_in: number }> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: 'fake-token', token_type: 'bearer', expires_in: 900, ...overrides }),
  };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('SoundchartsService', () => {
  let service: SoundchartsService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env['SOUNDCHARTS_CLIENT_ID'] = 'test-client-id';
    process.env['SOUNDCHARTS_CLIENT_SECRET'] = 'test-client-secret';
    const config = { get: (key: string) => process.env[key] } as unknown as ConfigService;
    service = new SoundchartsService(config);
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete process.env['SOUNDCHARTS_CLIENT_ID'];
    delete process.env['SOUNDCHARTS_CLIENT_SECRET'];
  });

  describe('autenticação e cache de token', () => {
    it('obtém um token via client_credentials (Basic auth ao endpoint de token)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(200, { items: [{ date: '2026-08-18', followerCount: 100 }] }));

      await service.getInstagramFollowers('uuid-1');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(TOKEN_URL);
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Authorization']).toMatch(/^Basic /);
      expect(init.body).toBe('grant_type=client_credentials');
    });

    it('reutiliza o token em cache enquanto ele ainda é válido (não pede um novo por chamada)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(200, { items: [{ date: '2026-08-18', followerCount: 1 }] }))
        .mockResolvedValueOnce(jsonResponse(200, { items: [{ date: '2026-08-18', followerCount: 2 }] }));

      await service.getInstagramFollowers('uuid-1');
      await service.getTikTokFollowers('uuid-1');

      const tokenCalls = fetchMock.mock.calls.filter(([url]) => url === TOKEN_URL);
      expect(tokenCalls).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(3); // 1 token + 2 chamadas de dado
    });

    it('renova o token quando ele expira', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(200, { items: [{ date: '2026-08-18', followerCount: 1 }] }));
      await service.getInstagramFollowers('uuid-1');

      // Força a expiração sem depender de fake timers (sem convenção de clock injetável neste repo).
      (service as any).cachedToken.expiresAt = Date.now() - 1;

      fetchMock
        .mockResolvedValueOnce(tokenResponse({ access_token: 'fake-token-2' }))
        .mockResolvedValueOnce(jsonResponse(200, { items: [{ date: '2026-08-18', followerCount: 2 }] }));
      await service.getInstagramFollowers('uuid-1');

      const tokenCalls = fetchMock.mock.calls.filter(([url]) => url === TOKEN_URL);
      expect(tokenCalls).toHaveLength(2);
    });

    it('credencial ausente: lança SoundchartsNotConfiguredError e nunca chama fetch', async () => {
      delete process.env['SOUNDCHARTS_CLIENT_ID'];
      delete process.env['SOUNDCHARTS_CLIENT_SECRET'];

      await expect(service.getInstagramFollowers('uuid-1')).rejects.toBeInstanceOf(SoundchartsNotConfiguredError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Spotify monthly listeners', () => {
    it('usa exclusivamente /streaming/spotify/listening — nunca /audience/spotify', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(200, { items: [{ date: '2026-08-18', value: 100_900_923 }] }));

      const result = await service.getSpotifyMonthlyListeners('uuid-1');

      expect(result).toEqual({
        value: 100_900_923,
        observedAt: new Date('2026-08-18'),
        source: 'soundcharts',
        // Provenance (auditoria 2026-08-31): endpoint/campo exatos de origem.
        endpoint: '/api/v2/artist/uuid-1/streaming/spotify/listening',
        field: 'items[].value',
        // Fase 2: série completa (mesmo payload) para backfill de histórico.
        series: [{ value: 100_900_923, observedAt: new Date('2026-08-18') }],
      });
      const dataCall = fetchMock.mock.calls.find(([url]) => url !== TOKEN_URL);
      expect(dataCall![0]).toContain('/streaming/spotify/listening');
      expect(dataCall![0]).not.toContain('/audience/spotify');
    });

    it('seleciona o item de data mais recente da série, independente da ordem do array', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
        jsonResponse(200, {
          items: [
            { date: '2026-08-16', value: 1 },
            { date: '2026-08-18', value: 3 }, // mais recente no meio do array — não deve confiar em [0] nem em [length-1]
            { date: '2026-08-17', value: 2 },
          ],
        }),
      );

      const result = await service.getSpotifyMonthlyListeners('uuid-1');
      expect(result.value).toBe(3);
      expect(result.observedAt).toEqual(new Date('2026-08-18'));
    });
  });

  describe('followerCount das demais plataformas', () => {
    const cases: Array<[string, () => Promise<{ value: number }>]> = [
      ['instagram', () => service.getInstagramFollowers('uuid-1')],
      ['tiktok', () => service.getTikTokFollowers('uuid-1')],
      ['deezer', () => service.getDeezerFans('uuid-1')],
      ['soundcloud', () => service.getSoundCloudFollowers('uuid-1')],
    ];

    it.each(cases)('%s: lê followerCount do item mais recente do endpoint /audience/%s', async (platform, call) => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(200, { items: [{ date: '2026-08-18', followerCount: 42_000 }] }));

      const result = await call();
      expect(result.value).toBe(42_000);
      const dataCall = fetchMock.mock.calls.find(([url]) => url !== TOKEN_URL);
      expect(dataCall![0]).toContain(`/audience/${platform}`);
    });
  });

  describe('getYouTubeAudience — SOUNDCHARTS ONLY (auditoria 2026-08-31)', () => {
    it('extrai subscribers/videos/views de UMA ÚNICA chamada a /audience/youtube, nunca da YouTube Data API', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
        jsonResponse(200, {
          items: [
            { date: '2026-08-01', followerCount: 15_400, postCount: 279, viewCount: 1_128_413 },
            { date: '2026-08-31', followerCount: 15_300, postCount: 277, viewCount: 1_221_926 },
          ],
        }),
      );

      const { subscribers, videos, views } = await service.getYouTubeAudience('uuid-1');

      expect(subscribers.value).toBe(15_300);
      expect(videos!.value).toBe(277);
      expect(views!.value).toBe(1_221_926);
      expect(subscribers.source).toBe('soundcharts');
      expect(videos!.source).toBe('soundcharts');
      expect(views!.source).toBe('soundcharts');

      // Exatamente 2 chamadas de rede no total (token + 1 dado) — nunca uma
      // segunda chamada de dados (que seria a YouTube Data API).
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const dataCalls = fetchMock.mock.calls.filter(([url]) => url !== TOKEN_URL);
      expect(dataCalls).toHaveLength(1);
      expect(dataCalls[0][0]).toContain('/audience/youtube');
      expect(String(dataCalls[0][0])).not.toContain('googleapis.com');
    });

    it('postCount/viewCount ausentes no payload real viram null — nunca um valor inventado ou buscado em outra API', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
        jsonResponse(200, { items: [{ date: '2026-08-31', followerCount: 100 }] }),
      );

      const { subscribers, videos, views } = await service.getYouTubeAudience('uuid-1');

      expect(subscribers.value).toBe(100);
      expect(videos).toBeNull();
      expect(views).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('erros HTTP', () => {
    it('404: lança SoundchartsNotFoundError', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(404, { errors: [{ message: 'not found' }] }));
      await expect(service.getInstagramFollowers('uuid-1')).rejects.toBeInstanceOf(SoundchartsNotFoundError);
    });

    it('429: lança SoundchartsRateLimitError', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(429, { errors: [{ message: 'rate limited' }] }));
      await expect(service.getInstagramFollowers('uuid-1')).rejects.toBeInstanceOf(SoundchartsRateLimitError);
    });
  });

  describe('getRelatedArtists (Fase 3.1 — descoberta de coorte de mercado)', () => {
    it('extrai items/total do payload real, filtra entradas sem uuid/name', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
        jsonResponse(200, {
          items: [
            { uuid: 'u1', name: 'Artist One' },
            { uuid: 'u2', name: 'Artist Two' },
            { name: 'sem uuid, deve ser descartado' },
          ],
          page: { offset: 0, limit: 100, total: 2 },
        }),
      );
      const result = await service.getRelatedArtists('uuid-1');
      expect(result.items).toEqual([{ uuid: 'u1', name: 'Artist One' }, { uuid: 'u2', name: 'Artist Two' }]);
      expect(result.total).toBe(2);
      const dataCall = fetchMock.mock.calls.find(([url]) => url !== TOKEN_URL);
      expect(dataCall![0]).toContain('/related?offset=0&limit=100');
    });

    it('404: retorna lista vazia (artista sem relacionados é uma resposta válida, não erro)', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(404, { errors: [] }));
      const result = await service.getRelatedArtists('uuid-1');
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('respeita offset/limit passados', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(200, { items: [], page: { total: 0 } }));
      await service.getRelatedArtists('uuid-1', 20, 50);
      const dataCall = fetchMock.mock.calls.find(([url]) => url !== TOKEN_URL);
      expect(dataCall![0]).toContain('/related?offset=20&limit=50');
    });
  });

  describe('getArtistCountryCode (Fase 3.1)', () => {
    it('extrai countryCode real quando presente', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(200, { object: { countryCode: 'BR' }, errors: [] }));
      expect(await service.getArtistCountryCode('uuid-1')).toBe('BR');
    });

    it('countryCode vazio (Soundcharts não sabe): null, nunca país inventado', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(200, { object: { countryCode: '' }, errors: [] }));
      expect(await service.getArtistCountryCode('uuid-1')).toBeNull();
    });

    it('404: null, sem lançar', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(404, { errors: [] }));
      expect(await service.getArtistCountryCode('uuid-1')).toBeNull();
    });
  });

  describe('resolução de artista e reuso de UUID (Soundcharts 06)', () => {
    it('resolveArtistByPlatform: cacheia o uuid por (platform, externalId) — segunda chamada não bate na rede', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(200, { uuid: 'sc-uuid-1' }));

      const first = await service.resolveArtistByPlatform('spotify', '6qqNVTkY8uBg9cP3Jd7DAH');
      const second = await service.resolveArtistByPlatform('spotify', '6qqNVTkY8uBg9cP3Jd7DAH');

      expect(first).toBe('sc-uuid-1');
      expect(second).toBe('sc-uuid-1');
      const resolveCalls = fetchMock.mock.calls.filter(([url]) => (url as string).includes('/artist/by-platform/'));
      expect(resolveCalls).toHaveLength(1); // dedup dentro da janela do cache — não repete a consulta pelo mesmo candidato
    });

    it('resolveCanonicalArtistUuid: usa o primeiro candidato que resolver e ignora os demais', async () => {
      const resolveSpy = jest.spyOn(service, 'resolveArtistByPlatform').mockImplementation(async (platform: string) => {
        if (platform === 'youtube') return 'sc-uuid-yt';
        throw new Error('não encontrado');
      });

      const uuid = await service.resolveCanonicalArtistUuid([
        { platform: 'spotify', externalId: null },
        { platform: 'youtube', externalId: 'UCiGm_E4ZwYSHV3bcW1pnSeQ' },
        { platform: 'deezer', externalId: '9635624' },
      ]);

      expect(uuid).toBe('sc-uuid-yt');
      expect(resolveSpy).toHaveBeenCalledTimes(1); // deezer nem chega a ser tentado
      resolveSpy.mockRestore();
    });
  });

  describe('Apple Music', () => {
    it('retorna NOT_SUPPORTED sem chamar a rede — nunca inventa um valor', () => {
      expect(service.getAppleMusicSupport()).toBe('NOT_SUPPORTED');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('getArtistIdentifiers (Métricas Fase 1.1 — evidência de identidade)', () => {
    it('retorna a lista completa de identifiers de todas as plataformas conhecidas pela Soundcharts para um UUID', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(200, {
          related: { uuid: 'uuid-1', slug: 'dj-stay', name: 'DJ Stay' },
          items: [
            { platformName: 'Spotify', platformCode: 'spotify', identifier: 'abc123', url: 'https://open.spotify.com/artist/abc123', default: true, verified: true },
            { platformName: 'Soundcloud', platformCode: 'soundcloud', identifier: 'djstay-sc', url: 'https://soundcloud.com/djstay-sc', default: true, verified: false },
          ],
        }));

      const result = await service.getArtistIdentifiers('uuid-1');

      expect(result.identifiers).toEqual([
        { platform: 'spotify', identifier: 'abc123' },
        { platform: 'soundcloud', identifier: 'djstay-sc' },
      ]);
    });

    it('404 (UUID sem identifiers) retorna lista vazia, nunca lança', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(404, { errors: [] }));

      const result = await service.getArtistIdentifiers('uuid-sem-identifiers');

      expect(result.identifiers).toEqual([]);
    });
  });

  describe('searchArtists (Métricas Fase 1.1 — evidência auxiliar, nunca prova identidade sozinha)', () => {
    it('retorna uuid+nome de cada resultado da busca', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(200, {
          items: [
            { uuid: 'uuid-a', name: 'DJ Stay' },
            { uuid: 'uuid-b', name: 'Dj Stay' },
          ],
        }));

      const result = await service.searchArtists('Dj Stay');

      expect(result.results).toEqual([
        { uuid: 'uuid-a', name: 'DJ Stay' },
        { uuid: 'uuid-b', name: 'Dj Stay' },
      ]);
    });

    it('sem resultados retorna lista vazia', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse(200, { items: [] }));

      const result = await service.searchArtists('artista-inexistente-xyz');

      expect(result.results).toEqual([]);
    });
  });
});
