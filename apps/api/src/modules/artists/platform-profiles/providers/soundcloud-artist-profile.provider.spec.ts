import { SoundCloudArtistProfileProvider } from './soundcloud-artist-profile.provider';
import type { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';

const CANONICAL_URLS = {
  spotifyUrl: 'https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH',
  youtubeUrl: 'https://www.youtube.com/channel/UCiGm_E4ZwYSHV3bcW1pnSeQ',
};

describe('SoundCloudArtistProfileProvider.resolve (Métricas Fase 1 — proteção contra conta homônima)', () => {
  it('6) segue persistindo followers normalmente quando o UUID do próprio handle bate com o canônico (regressão do caminho saudável)', async () => {
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

  it('7) FASE 1.3 — reprodução do bug real DJ Stay: resolução EXATA pelo slug cadastrado (deejaystay) nunca é bloqueada só porque outra âncora (Spotify) resolve para uma entidade Soundcharts diferente (fragmentação de catalogação, não erro de cadastro). A métrica real da conta cadastrada é aceita, com a divergência anotada como diagnóstico.', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      // Resolução EXATA by-platform do slug cadastrado "deejaystay".
      resolveArtistByPlatform: jest.fn().mockResolvedValue('ceb88425-soundcloud-entity'),
      // A cadeia canônica (Spotify) resolve para uma entidade Soundcharts DIFERENTE
      // — mesmo artista, mas catalogado separadamente pela própria Soundcharts.
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

    // A métrica da conta EXATAMENTE cadastrada é buscada e persistida — nunca bloqueada.
    expect(soundcharts.getSoundCloudFollowers).toHaveBeenCalledWith('ceb88425-soundcloud-entity');
    expect(snapshot.followers).toBe(20775);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
    expect(snapshot.raw_payload.cross_platform_status).toBe('CROSS_PLATFORM_DIVERGENT');
    expect(snapshot.raw_payload.cross_platform_uuid).toBe('11e81bc0-spotify-entity');
    expect(snapshot.raw_payload.cross_platform_registry_identifier).toBe('djstay-sc');
  });

  it('8) sem nenhuma outra âncora cadastrada (só SoundCloud): sem dado para cross-checar, segue o caminho normal', async () => {
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

  it('9) requested identifier ausente/inválido → erro antes de qualquer resolução (PROFILE_NOT_FOUND real nunca é confundido com mismatch de identidade)', async () => {
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
    ).rejects.toThrow('SoundCloud profile slug ausente ou inválido');
    expect(soundcharts.resolveArtistByPlatform).not.toHaveBeenCalled();
  });

  it('10) sem nenhuma outra âncora resolvível: cross-platform evidence fica UNKNOWN, métrica ainda é persistida normalmente', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('uuid-x'),
      resolveCanonicalArtistUuid: jest.fn().mockRejectedValue(new Error('não encontrado')),
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

  it('find-4e35ea8e: slug resolvido com sucesso (existe de verdade) mas não indexado na Soundcharts (404): followers=null, sync_status=success (NUNCA "failed")', async () => {
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

  it('erro real da Soundcharts (não 404) durante a resolução propaga como falha genuína (retry deve acontecer)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new Error('Soundcharts 503: serviço indisponível')),
      getSoundCloudFollowers: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new SoundCloudArtistProfileProvider(soundcharts);

    await expect(provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'deejaystay',
      externalUrl: null,
      canonicalUrls: {},
    })).rejects.toThrow('Soundcharts 503: serviço indisponível');
  });
});
