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
  it('extrai o id de cada plataforma na ordem spotify → youtube → deezer → soundcloud', () => {
    expect(buildCanonicalCandidates(URLS)).toEqual([
      { platform: 'spotify', externalId: '6qqNVTkY8uBg9cP3Jd7DAH' },
      { platform: 'youtube', externalId: 'UCiGm_E4ZwYSHV3bcW1pnSeQ' },
      { platform: 'deezer', externalId: '9635624' },
      { platform: 'soundcloud', externalId: 'billieeilish' },
    ]);
  });

  it('externalId null quando a URL da plataforma está ausente', () => {
    expect(buildCanonicalCandidates({})).toEqual([
      { platform: 'spotify', externalId: null },
      { platform: 'youtube', externalId: null },
      { platform: 'deezer', externalId: null },
      { platform: 'soundcloud', externalId: null },
    ]);
  });
});

describe('evaluateCrossPlatformEvidence (Fase 1.3 — puramente diagnóstico, nunca bloqueia)', () => {
  it('1) CROSS_PLATFORM_UNKNOWN quando nenhuma outra âncora está cadastrada — nada a comparar', async () => {
    const soundcharts = { resolveCanonicalArtistUuid: jest.fn() } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, {}, 'soundcloud', 'own-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_UNKNOWN', independentUuid: null, registryIdentifier: null });
    expect(soundcharts.resolveCanonicalArtistUuid).not.toHaveBeenCalled();
  });

  it('2) CROSS_PLATFORM_CONSISTENT quando o UUID independente BATE com o UUID resolvido pelo próprio handle', async () => {
    const soundcharts = {
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('same-uuid'),
    } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'same-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_CONSISTENT', independentUuid: 'same-uuid', registryIdentifier: null });
  });

  it('3) CROSS_PLATFORM_DIVERGENT quando o UUID independente DIVERGE do UUID resolvido pelo próprio handle — sem registry disponível', async () => {
    const soundcharts = {
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid-artist-a'),
      getArtistIdentifiers: jest.fn().mockRejectedValue(new Error('não encontrado')),
    } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'own-resolved-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_DIVERGENT', independentUuid: 'canonical-uuid-artist-a', registryIdentifier: null });
  });

  it('3b) em divergência, busca no registry do canônico o identifier desta plataforma como evidência (achado real: SoundCloud "deejaystay" cadastrado vs. "djstay-sc" no registry do canônico — diagnóstico, nunca aplicado)', async () => {
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

  it('4) CROSS_PLATFORM_UNKNOWN quando as outras âncoras existem mas nenhuma resolve na Soundcharts', async () => {
    const soundcharts = {
      resolveCanonicalArtistUuid: jest.fn().mockRejectedValue(new Error('não encontrado')),
    } as unknown as SoundchartsService;

    const result = await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'own-uuid');

    expect(result).toEqual({ status: 'CROSS_PLATFORM_UNKNOWN', independentUuid: null, registryIdentifier: null });
  });

  it('5) nunca inclui a própria plataforma sendo verificada nos candidatos independentes (evita tautologia)', async () => {
    const resolveCanonicalArtistUuid = jest.fn().mockResolvedValue('x');
    const soundcharts = { resolveCanonicalArtistUuid } as unknown as SoundchartsService;

    await evaluateCrossPlatformEvidence(soundcharts, URLS, 'soundcloud', 'x');

    const candidates = resolveCanonicalArtistUuid.mock.calls[0][0] as Array<{ platform: string }>;
    expect(candidates.some((c) => c.platform === 'soundcloud')).toBe(false);
    expect(candidates.map((c) => c.platform)).toEqual(['spotify', 'youtube', 'deezer']);
  });
});

describe('checkRegisteredHandleAgainstRegistry (Fase 1.3 — evidência secundária de fallback)', () => {
  it('CONFIRMED quando o registry do canônico lista exatamente o handle cadastrado', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'instagram', identifier: 'djstayofc' }],
      }),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('CONFIRMED');
  });

  it('comparação é case-insensitive', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'instagram', identifier: 'DjStayOfc' }],
      }),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('CONFIRMED');
  });

  it('MISMATCH quando o registry lista um identifier DIFERENTE do cadastrado', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'instagram', identifier: 'outra-conta-qualquer' }],
      }),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('MISMATCH');
  });

  it('INSUFFICIENT_EVIDENCE quando o registry não lista essa plataforma — ausência de dado nunca vira CONFIRMED', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'spotify', identifier: 'abc123' }],
      }),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('INSUFFICIENT_EVIDENCE quando a consulta ao registry falha — indisponibilidade nunca vira CONFIRMED', async () => {
    const soundcharts = {
      getArtistIdentifiers: jest.fn().mockRejectedValue(new Error('timeout')),
    } as unknown as SoundchartsService;

    const status = await checkRegisteredHandleAgainstRegistry(soundcharts, 'canonical-uuid', 'instagram', 'djstayofc');

    expect(status).toBe('INSUFFICIENT_EVIDENCE');
  });
});

describe('resolveCanonicalUuidForProvider — reuso de UUID entre plataformas (Soundcharts 06)', () => {
  it('Spotify resolve UUID → Instagram usa o mesmo UUID, sem consultar YouTube/Deezer/SoundCloud/handle próprio', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      if (platform === 'spotify') return 'sc-uuid-1';
      throw new Error(`não deveria consultar ${platform}`);
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'instagram', 'billieeilish');

    expect(uuid).toBe('sc-uuid-1');
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledTimes(1);
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('spotify', '6qqNVTkY8uBg9cP3Jd7DAH');
  });

  it('Spotify resolve UUID → TikTok usa o mesmo UUID, sem consultar o handle próprio', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      if (platform === 'spotify') return 'sc-uuid-1';
      throw new Error(`não deveria consultar ${platform}`);
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'tiktok', 'billieeilish');

    expect(uuid).toBe('sc-uuid-1');
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledTimes(1);
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('spotify', '6qqNVTkY8uBg9cP3Jd7DAH');
  });

  it('Spotify falha → YouTube resolve (Deezer/SoundCloud/handle próprio não são consultados)', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    const attempted: string[] = [];
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      attempted.push(platform);
      if (platform === 'spotify') throw new Error('não encontrado');
      if (platform === 'youtube') return 'sc-uuid-2';
      throw new Error(`não deveria consultar ${platform}`);
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'instagram', 'billieeilish');

    expect(uuid).toBe('sc-uuid-2');
    expect(attempted).toEqual(['spotify', 'youtube']);
  });

  it('Spotify e YouTube falham → Deezer resolve (SoundCloud/handle próprio não são consultados)', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    const attempted: string[] = [];
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      attempted.push(platform);
      if (platform === 'deezer') return 'sc-uuid-3';
      throw new Error('não encontrado');
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'tiktok', 'billieeilish');

    expect(uuid).toBe('sc-uuid-3');
    expect(attempted).toEqual(['spotify', 'youtube', 'deezer']);
  });

  it('todas as 4 canônicas falham → ownPlatform (handle próprio) é o fallback final', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    const attempted: string[] = [];
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      attempted.push(platform);
      if (platform === 'instagram') return 'sc-uuid-own';
      throw new Error('não encontrado');
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, URLS, 'instagram', 'billieeilish');

    expect(uuid).toBe('sc-uuid-own');
    expect(attempted).toEqual(['spotify', 'youtube', 'deezer', 'soundcloud', 'instagram']);
  });

  it('sem nenhuma URL canônica cadastrada, resolve direto pelo handle próprio', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    soundcharts.resolveArtistByPlatform = jest.fn(async (platform: string) => {
      if (platform === 'tiktok') return 'sc-uuid-own';
      throw new Error(`não deveria consultar ${platform}`);
    }) as never;

    const uuid = await resolveCanonicalUuidForProvider(soundcharts, undefined, 'tiktok', 'billieeilish');

    expect(uuid).toBe('sc-uuid-own');
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledTimes(1);
    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('tiktok', 'billieeilish');
  });

  it('todas as tentativas (inclusive ownPlatform) falham → erro agregado, sem UUID inventado', async () => {
    const soundcharts = new SoundchartsService(fakeConfig);
    soundcharts.resolveArtistByPlatform = jest.fn(async () => { throw new Error('não encontrado'); }) as never;

    await expect(
      resolveCanonicalUuidForProvider(soundcharts, URLS, 'instagram', 'billieeilish'),
    ).rejects.toThrow(/não foi possível resolver o artista/);
  });
});
