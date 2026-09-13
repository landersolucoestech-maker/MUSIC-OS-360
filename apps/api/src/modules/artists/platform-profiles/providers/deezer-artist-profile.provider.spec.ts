import { DeezerArtistProfileProvider } from './deezer-artist-profile.provider';
import type { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';

const CANONICAL_URLS = {
  spotifyUrl: 'https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH',
  youtubeUrl: 'https://www.youtube.com/channel/UCiGm_E4ZwYSHV3bcW1pnSeQ',
};

describe('DeezerArtistProfileProvider.resolve (Métricas Fase 1 — proteção contra conta homônima)', () => {
  it('12) UUID do próprio handle bate com o canônico independente: fãs (followers) persistidos normalmente', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('same-uuid'),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('same-uuid'),
      getDeezerFans: jest.fn().mockResolvedValue({ value: 12345, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
    } as unknown as SoundchartsService;
    const provider = new DeezerArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: '9635624',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(snapshot.followers).toBe(12345);
    expect(snapshot.sync_status).toBe('success');
  });

  it('13) FASE 1.3 — UUID do próprio handle DIVERGE do canônico (Spotify/YouTube): resolução exata pelo artistId cadastrado ainda é aceita; divergência vira só diagnóstico', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('deezer-own-uuid'),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({ raw: {}, identifiers: [] }),
      getDeezerFans: jest.fn().mockResolvedValue({ value: 888888, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
    } as unknown as SoundchartsService;
    const provider = new DeezerArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'registered-id',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(soundcharts.getDeezerFans).toHaveBeenCalledWith('deezer-own-uuid');
    expect(snapshot.followers).toBe(888888);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
    expect(snapshot.raw_payload.cross_platform_status).toBe('CROSS_PLATFORM_DIVERGENT');
  });

  it('find-4e35ea8e: artistId resolvido com sucesso (existe de verdade) mas não indexado na Soundcharts (404): followers=null, sync_status=success (NUNCA "failed")', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      getDeezerFans: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new DeezerArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: '9635624',
      externalUrl: null,
      canonicalUrls: {},
    });

    expect(soundcharts.getDeezerFans).not.toHaveBeenCalled();
    expect(snapshot.followers).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.external_id).toBe('9635624');
  });

  it('erro real da Soundcharts (não 404) durante a resolução propaga como falha genuína (retry deve acontecer)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new Error('Soundcharts 503: serviço indisponível')),
      getDeezerFans: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new DeezerArtistProfileProvider(soundcharts);

    await expect(provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: '9635624',
      externalUrl: null,
      canonicalUrls: {},
    })).rejects.toThrow('Soundcharts 503: serviço indisponível');
  });
});
