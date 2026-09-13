import { BadRequestException } from '@nestjs/common';
import { ArtistExternalProfileSyncService } from './artist-external-profile-sync.service';
import { ArtistPlatformSyncProcessor } from '../../../queues/processors/artist-platform-sync.processor';
import { ARTIST_PLATFORM_PROFILE_JOB_NAMES } from '../../../queues/queue.constants';
import { IntegrationBaseService } from '../../integrations/integration-base.service';
import { SpotifyArtistProfileProvider } from './providers/spotify-artist-profile.provider';
import { YouTubeArtistProfileProvider } from './providers/youtube-artist-profile.provider';
import { DeezerArtistProfileProvider } from './providers/deezer-artist-profile.provider';
import { SoundCloudArtistProfileProvider } from './providers/soundcloud-artist-profile.provider';
import { InstagramArtistProfileProvider } from './providers/instagram-artist-profile.provider';
import { TikTokArtistProfileProvider } from './providers/tiktok-artist-profile.provider';

const payload = {
  tenant_id: 'tenant-1',
  artist_id: 'artist-1',
  platform: 'spotify' as const,
  external_id: '4NHQUGzhtTLFvgF5SZesLK',
  external_url: 'https://open.spotify.com/artist/4NHQUGzhtTLFvgF5SZesLK',
  requested_by: 'user-1',
  reason: 'manual' as const,
  idempotency_key: 'tenant-1__artist-1__spotify__manual__hash',
};

/** Mock do DatabaseContextService no padrão do notifications.processor.spec. */
const makeDbContext = () => ({
  runInTenantContext: jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(undefined)),
});

const SPOTIFY_ID = '4NHQUGzhtTLFvgF5SZesLK';
const YOUTUBE_ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';

describe('Separação de domínio: métricas do artista NUNCA dependem de OAuth da organização', () => {
  it('nenhum ArtistPlatformProvider estende IntegrationBaseService (base das conexões OAuth de tenant/Ads/Marketing)', () => {
    for (const Provider of [
      SpotifyArtistProfileProvider,
      YouTubeArtistProfileProvider,
      DeezerArtistProfileProvider,
      SoundCloudArtistProfileProvider,
      InstagramArtistProfileProvider,
      TikTokArtistProfileProvider,
    ]) {
      expect(Provider.prototype instanceof IntegrationBaseService).toBe(false);
    }
  });

  it('ArtistExternalProfileSyncService não injeta nenhum serviço de integração OAuth (Instagram/TikTok/Meta/SoundCloud Ads)', () => {
    // Assinatura do construtor é a superfície real de dependências — se algum dia
    // alguém tentar resolver métrica de artista via conexão OAuth da organização,
    // este teste quebra porque um novo parâmetro apareceria aqui.
    expect(ArtistExternalProfileSyncService.length).toBe(4);
  });
});

describe('ArtistExternalProfileSyncService', () => {
  it('sync manual de Spotify resolve direto (sem BullMQ) via SpotifyArtistProfileProvider', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
      upsertSuccess: jest.fn().mockResolvedValue({}),
      markFailed: jest.fn(),
    };
    const spotifyProvider = {
      resolve: jest.fn().mockResolvedValue({
        tenant_id: 'tenant-1',
        artist_id: 'artist-1',
        platform: 'spotify',
        external_id: SPOTIFY_ID,
        monthly_listeners: 54321,
        sync_status: 'success',
      }),
    };
    const queue = { add: jest.fn() };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      spotifyProvider as never,
      queue as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'spotify',
      requestedBy: 'user-1',
      profileUrl: `https://open.spotify.com/artist/${SPOTIFY_ID}`,
    });

    expect(profiles.upsertPending).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'spotify',
      externalId: SPOTIFY_ID,
      externalUrl: `https://open.spotify.com/artist/${SPOTIFY_ID}`,
    }));
    expect(spotifyProvider.resolve).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      externalId: SPOTIFY_ID,
      externalUrl: `https://open.spotify.com/artist/${SPOTIFY_ID}`,
    }));
    expect(profiles.upsertSuccess).toHaveBeenCalledWith(expect.objectContaining({ monthly_listeners: 54321 }));
    // Spotify resolve é síncrono no request — nunca passa pelo BullMQ.
    expect(queue.add).not.toHaveBeenCalled();
    expect(result.enqueued).toEqual([{ platform: 'spotify', job_id: expect.stringContaining('direct-') }]);
  });

  it('enfileira sync manual de YouTube', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-2' }) };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      { resolve: jest.fn() } as never,
      queue as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'youtube',
      requestedBy: 'user-1',
      profileUrl: `https://www.youtube.com/channel/${YOUTUBE_ID}`,
    });

    expect(queue.add).toHaveBeenCalledWith(
      ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      expect.objectContaining({
        platform: 'youtube',
        external_id: YOUTUBE_ID,
        external_url: `https://www.youtube.com/channel/${YOUTUBE_ID}`,
      }),
      expect.any(Object),
    );
    expect(result.enqueued).toEqual([{ platform: 'youtube', job_id: 'job-2' }]);
  });

  it('enfileira sync manual de YouTube a partir de um @handle (find-eb3c5c45-class: o extrator antigo rejeitava handles, só aceitava UC.../channel/UC...)', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-2b' }) };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      { resolve: jest.fn() } as never,
      queue as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'youtube',
      requestedBy: 'user-1',
      profileUrl: '@some_artist_handle',
    });

    // externalId fica null (resolução do UC... exige a chamada assíncrona à
    // YouTube Data API que só o worker faz); externalUrl carrega a
    // referência para o worker resolver — nunca um BadRequestException.
    expect(queue.add).toHaveBeenCalledWith(
      ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      expect.objectContaining({
        platform: 'youtube',
        external_id: null,
        external_url: 'https://www.youtube.com/@some_artist_handle',
      }),
      expect.any(Object),
    );
    expect(result.enqueued).toEqual([{ platform: 'youtube', job_id: 'job-2b' }]);
  });

  it('rejeita link de YouTube genuinamente não reconhecível em nenhum formato suportado', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null }),
    };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      { hasRecentPending: jest.fn(), upsertPending: jest.fn() } as never,
      { resolve: jest.fn() } as never,
      { add: jest.fn() } as never,
    );

    await expect(service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'youtube',
      requestedBy: 'user-1',
      profileUrl: '!!!totally-invalid!!!',
    })).rejects.toThrow('Link do YouTube inválido');
  });

  it('find (Bug 1, distributed-systems-reviewer): não escreve sync_status=pending quando queue.add() lança — sem isso, a linha ficava órfã para sempre (nada jamais a processaria)', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
    };
    const queue = { add: jest.fn().mockRejectedValue(new Error('Redis ECONNRESET')) };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      { resolve: jest.fn() } as never,
      queue as never,
    );

    await expect(service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'youtube',
      requestedBy: 'user-1',
      profileUrl: `https://www.youtube.com/channel/${YOUTUBE_ID}`,
    })).rejects.toThrow('Falha ao enfileirar sincronização');

    expect(profiles.upsertPending).not.toHaveBeenCalled();
  });

  it('enfileira sync manual de Deezer', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null, deezer_url: null }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-3' }) };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      { resolve: jest.fn() } as never,
      queue as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'deezer',
      requestedBy: 'user-1',
      profileUrl: 'https://www.deezer.com/br/artist/27',
    });

    expect(queue.add).toHaveBeenCalledWith(
      ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      expect.objectContaining({
        platform: 'deezer',
        external_id: '27',
        external_url: 'https://www.deezer.com/artist/27',
      }),
      expect.any(Object),
    );
    expect(result.enqueued).toEqual([{ platform: 'deezer', job_id: 'job-3' }]);
  });

  it('enfileira sync manual de SoundCloud pelo perfil publico do artista (nao exige credencial de organizacao para resolver a URL)', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null, soundcloud_url: null }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-4' }) };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      { resolve: jest.fn() } as never,
      queue as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'soundcloud',
      requestedBy: 'user-1',
      profileUrl: 'https://soundcloud.com/artist-handle',
    });

    expect(queue.add).toHaveBeenCalledWith(
      ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      expect.objectContaining({
        platform: 'soundcloud',
        external_id: 'artist-handle',
        external_url: 'https://soundcloud.com/artist-handle',
      }),
      expect.any(Object),
    );
    expect(result.enqueued).toEqual([{ platform: 'soundcloud', job_id: 'job-4' }]);
  });

  it('enfileira sync manual de Instagram (métrica de artista, sem OAuth de Marketing)', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null, metadata: {} }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-5' }) };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      { resolve: jest.fn() } as never,
      queue as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'instagram',
      requestedBy: 'user-1',
      profileUrl: 'https://www.instagram.com/artist_handle',
    });

    expect(queue.add).toHaveBeenCalledWith(
      ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      expect.objectContaining({
        platform: 'instagram',
        external_id: 'artist_handle',
        external_url: 'https://www.instagram.com/artist_handle',
      }),
      expect.any(Object),
    );
    expect(result.enqueued).toEqual([{ platform: 'instagram', job_id: 'job-5' }]);
  });

  it('enfileira sync manual de TikTok (métrica de artista, sem OAuth de Marketing)', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null, metadata: {} }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-6' }) };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      { resolve: jest.fn() } as never,
      queue as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'tiktok',
      requestedBy: 'user-1',
      profileUrl: 'https://www.tiktok.com/@artist_handle',
    });

    expect(queue.add).toHaveBeenCalledWith(
      ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      expect.objectContaining({
        platform: 'tiktok',
        external_id: 'artist_handle',
        external_url: 'https://www.tiktok.com/@artist_handle',
      }),
      expect.any(Object),
    );
    expect(result.enqueued).toEqual([{ platform: 'tiktok', job_id: 'job-6' }]);
  });

  it('resolve Instagram/TikTok a partir do metadata em cache quando nenhuma profileUrl é enviada', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({
        id: 'artist-1',
        spotify_url: null,
        youtube_url: null,
        metadata: { instagram_url: 'https://www.instagram.com/cached_handle' },
      }),
    };
    const profiles = {
      hasRecentPending: jest.fn().mockResolvedValue(false),
      upsertPending: jest.fn().mockResolvedValue({}),
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-7' }) };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      profiles as never,
      { resolve: jest.fn() } as never,
      queue as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'instagram',
      requestedBy: 'user-1',
    });

    expect(queue.add).toHaveBeenCalledWith(
      ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      expect.objectContaining({ platform: 'instagram', external_id: 'cached_handle' }),
      expect.any(Object),
    );
    expect(result.enqueued).toEqual([{ platform: 'instagram', job_id: 'job-7' }]);
  });

  it('retorna skipped quando artista nao tem perfil externo da plataforma', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null }),
    };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      { hasRecentPending: jest.fn(), upsertPending: jest.fn() } as never,
      { resolve: jest.fn() } as never,
      { add: jest.fn() } as never,
    );

    const result = await service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'spotify',
      requestedBy: 'user-1',
    });

    expect(result).toEqual({
      artist_id: 'artist-1',
      enqueued: [],
      skipped: [{ platform: 'spotify', reason: 'missing_external_profile' }],
    });
  });

  it('rejeita plataforma fora do conjunto suportado', async () => {
    const service = new ArtistExternalProfileSyncService({} as never, {} as never, {} as never, null);
    await expect(service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'facebook',
      requestedBy: 'user-1',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita link Spotify que nao seja de artista', async () => {
    const artists = {
      findById: jest.fn().mockResolvedValue({ id: 'artist-1', spotify_url: null, youtube_url: null }),
    };
    const service = new ArtistExternalProfileSyncService(
      artists as never,
      { hasRecentPending: jest.fn(), upsertPending: jest.fn() } as never,
      { resolve: jest.fn() } as never,
      { add: jest.fn() } as never,
    );

    await expect(service.enqueueManualSync({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'spotify',
      requestedBy: 'user-1',
      profileUrl: 'https://open.spotify.com/track/abc',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ArtistPlatformSyncProcessor', () => {
  it('persiste success usando artista carregado por tenant + id', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'artist-1',
      tenant_id: 'tenant-1',
      spotify_url: 'https://open.spotify.com/artist/spotify-current',
      youtube_url: null,
    });
    const ds = { getRepository: jest.fn(() => ({ findOne })) };
    const profiles = {
      upsertPending: jest.fn().mockResolvedValue({}),
      upsertSuccess: jest.fn().mockResolvedValue({}),
      markFailed: jest.fn(),
    };
    const spotify = {
      platform: 'spotify',
      resolve: jest.fn().mockResolvedValue({
        tenant_id: 'tenant-1',
        artist_id: 'artist-1',
        platform: 'spotify',
        external_id: SPOTIFY_ID,
        sync_status: 'success',
      }),
    };
    const dbContext = makeDbContext();
    const processor = new ArtistPlatformSyncProcessor(
      ds as never,
      profiles as never,
      dbContext as never,
      spotify as never,
      { platform: 'youtube' } as never,
      { platform: 'deezer' } as never,
      { platform: 'soundcloud' } as never,
      { platform: 'instagram' } as never,
      { platform: 'tiktok' } as never,
      { platform: 'apple-music' } as never,
    );

    await processor.process({ name: ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC, data: payload } as never);

    // FORCE RLS: toda a persistência do worker roda dentro do contexto do tenant do job.
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', orgId: null, role: null },
      expect.any(Function),
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'artist-1', tenant_id: 'tenant-1', deleted_at: null },
    });
    expect(spotify.resolve).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      externalId: SPOTIFY_ID,
      externalUrl: `https://open.spotify.com/artist/${SPOTIFY_ID}`,
      canonicalUrls: expect.objectContaining({ spotifyUrl: 'https://open.spotify.com/artist/spotify-current' }),
    }));
    expect(profiles.upsertSuccess).toHaveBeenCalled();
    expect(profiles.markFailed).not.toHaveBeenCalled();
  });

  it('persiste failed quando provider falha', async () => {
    const ds = {
      getRepository: jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({ id: 'artist-1', tenant_id: 'tenant-1', spotify_url: 'https://open.spotify.com/artist/spotify-1' }),
      })),
    };
    const profiles = {
      upsertPending: jest.fn().mockResolvedValue({}),
      upsertSuccess: jest.fn(),
      markFailed: jest.fn().mockResolvedValue({}),
    };
    const spotify = {
      platform: 'spotify',
      resolve: jest.fn().mockRejectedValue(new Error('Spotify API respondeu 429: limite de requisições excedido')),
    };
    const processor = new ArtistPlatformSyncProcessor(
      ds as never,
      profiles as never,
      makeDbContext() as never,
      spotify as never,
      { platform: 'youtube' } as never,
      { platform: 'deezer' } as never,
      { platform: 'soundcloud' } as never,
      { platform: 'instagram' } as never,
      { platform: 'tiktok' } as never,
      { platform: 'apple-music' } as never,
    );

    // find (Bug 2): process() must reject on a genuine provider failure —
    // swallowing this instead of rethrowing is exactly what made BullMQ's
    // attempts:3/backoff dead configuration (job always looked 'completed').
    await expect(
      processor.process({ name: ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC, data: payload } as never),
    ).rejects.toThrow('Spotify API respondeu 429: limite de requisições excedido');

    expect(profiles.upsertSuccess).not.toHaveBeenCalled();
    expect(profiles.markFailed).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      artistId: 'artist-1',
      platform: 'spotify',
      error: 'Spotify API respondeu 429: limite de requisições excedido',
    }));
  });

  it('roteia job de Deezer para o DeezerArtistProfileProvider e persiste fas', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'artist-1',
      tenant_id: 'tenant-1',
      deezer_url: 'https://www.deezer.com/artist/27',
    });
    const ds = { getRepository: jest.fn(() => ({ findOne })) };
    const profiles = {
      upsertPending: jest.fn().mockResolvedValue({}),
      upsertSuccess: jest.fn().mockResolvedValue({}),
      markFailed: jest.fn(),
    };
    const deezer = {
      platform: 'deezer',
      resolve: jest.fn().mockResolvedValue({
        tenant_id: 'tenant-1',
        artist_id: 'artist-1',
        platform: 'deezer',
        external_id: '27',
        followers: 12345,
        sync_status: 'success',
      }),
    };
    const processor = new ArtistPlatformSyncProcessor(
      ds as never,
      profiles as never,
      makeDbContext() as never,
      { platform: 'spotify' } as never,
      { platform: 'youtube' } as never,
      deezer as never,
      { platform: 'soundcloud' } as never,
      { platform: 'instagram' } as never,
      { platform: 'tiktok' } as never,
      { platform: 'apple-music' } as never,
    );

    await processor.process({
      name: ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      data: { ...payload, platform: 'deezer' as const, external_id: '27', external_url: 'https://www.deezer.com/artist/27' },
    } as never);

    expect(deezer.resolve).toHaveBeenCalledWith(expect.objectContaining({ externalId: '27' }));
    expect(profiles.upsertSuccess).toHaveBeenCalledWith(expect.objectContaining({ platform: 'deezer', followers: 12345 }));
    expect(profiles.markFailed).not.toHaveBeenCalled();
  });

  it('roteia job de SoundCloud para o SoundCloudArtistProfileProvider e persiste seguidores do PERFIL DO ARTISTA', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'artist-1',
      tenant_id: 'tenant-1',
      soundcloud_url: 'https://soundcloud.com/artist-handle',
    });
    const ds = { getRepository: jest.fn(() => ({ findOne })) };
    const profiles = {
      upsertPending: jest.fn().mockResolvedValue({}),
      upsertSuccess: jest.fn().mockResolvedValue({}),
      markFailed: jest.fn(),
    };
    const soundcloud = {
      platform: 'soundcloud',
      resolve: jest.fn().mockResolvedValue({
        tenant_id: 'tenant-1',
        artist_id: 'artist-1',
        platform: 'soundcloud',
        external_id: 'artist-handle',
        followers: 54321,
        sync_status: 'success',
      }),
    };
    const processor = new ArtistPlatformSyncProcessor(
      ds as never,
      profiles as never,
      makeDbContext() as never,
      { platform: 'spotify' } as never,
      { platform: 'youtube' } as never,
      { platform: 'deezer' } as never,
      soundcloud as never,
      { platform: 'instagram' } as never,
      { platform: 'tiktok' } as never,
      { platform: 'apple-music' } as never,
    );

    await processor.process({
      name: ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      data: { ...payload, platform: 'soundcloud' as const, external_id: 'artist-handle', external_url: 'https://soundcloud.com/artist-handle' },
    } as never);

    expect(soundcloud.resolve).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'artist-handle' }));
    expect(profiles.upsertSuccess).toHaveBeenCalledWith(expect.objectContaining({ platform: 'soundcloud', followers: 54321 }));
    expect(profiles.markFailed).not.toHaveBeenCalled();
  });

  it('roteia job de Instagram para o InstagramArtistProfileProvider, reaproveitando o UUID já resolvido via Spotify (canonicalUrls)', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'artist-1',
      tenant_id: 'tenant-1',
      spotify_url: 'https://open.spotify.com/artist/spotify-current',
      metadata: { instagram_url: 'https://www.instagram.com/artist-handle' },
    });
    const ds = { getRepository: jest.fn(() => ({ findOne })) };
    const profiles = {
      upsertPending: jest.fn().mockResolvedValue({}),
      upsertSuccess: jest.fn().mockResolvedValue({}),
      markFailed: jest.fn(),
    };
    const instagram = {
      platform: 'instagram',
      resolve: jest.fn().mockResolvedValue({
        tenant_id: 'tenant-1',
        artist_id: 'artist-1',
        platform: 'instagram',
        external_id: 'artist-handle',
        followers: 111222,
        sync_status: 'success',
      }),
    };
    const processor = new ArtistPlatformSyncProcessor(
      ds as never,
      profiles as never,
      makeDbContext() as never,
      { platform: 'spotify' } as never,
      { platform: 'youtube' } as never,
      { platform: 'deezer' } as never,
      { platform: 'soundcloud' } as never,
      instagram as never,
      { platform: 'tiktok' } as never,
      { platform: 'apple-music' } as never,
    );

    await processor.process({
      name: ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      data: { ...payload, platform: 'instagram' as const, external_id: 'artist-handle', external_url: 'https://www.instagram.com/artist-handle' },
    } as never);

    expect(instagram.resolve).toHaveBeenCalledWith(expect.objectContaining({
      externalId: 'artist-handle',
      canonicalUrls: expect.objectContaining({ spotifyUrl: 'https://open.spotify.com/artist/spotify-current' }),
    }));
    expect(profiles.upsertSuccess).toHaveBeenCalledWith(expect.objectContaining({ platform: 'instagram', followers: 111222 }));
    expect(profiles.markFailed).not.toHaveBeenCalled();
  });

  it('roteia job de TikTok para o TikTokArtistProfileProvider, reaproveitando o UUID já resolvido via Spotify (canonicalUrls)', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'artist-1',
      tenant_id: 'tenant-1',
      spotify_url: 'https://open.spotify.com/artist/spotify-current',
      metadata: { tiktok_url: 'https://www.tiktok.com/@artist-handle' },
    });
    const ds = { getRepository: jest.fn(() => ({ findOne })) };
    const profiles = {
      upsertPending: jest.fn().mockResolvedValue({}),
      upsertSuccess: jest.fn().mockResolvedValue({}),
      markFailed: jest.fn(),
    };
    const tiktok = {
      platform: 'tiktok',
      resolve: jest.fn().mockResolvedValue({
        tenant_id: 'tenant-1',
        artist_id: 'artist-1',
        platform: 'tiktok',
        external_id: 'artist-handle',
        followers: 333444,
        sync_status: 'success',
      }),
    };
    const processor = new ArtistPlatformSyncProcessor(
      ds as never,
      profiles as never,
      makeDbContext() as never,
      { platform: 'spotify' } as never,
      { platform: 'youtube' } as never,
      { platform: 'deezer' } as never,
      { platform: 'soundcloud' } as never,
      { platform: 'instagram' } as never,
      tiktok as never,
      { platform: 'apple-music' } as never,
    );

    await processor.process({
      name: ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      data: { ...payload, platform: 'tiktok' as const, external_id: 'artist-handle', external_url: 'https://www.tiktok.com/@artist-handle' },
    } as never);

    expect(tiktok.resolve).toHaveBeenCalledWith(expect.objectContaining({
      externalId: 'artist-handle',
      canonicalUrls: expect.objectContaining({ spotifyUrl: 'https://open.spotify.com/artist/spotify-current' }),
    }));
    expect(profiles.upsertSuccess).toHaveBeenCalledWith(expect.objectContaining({ platform: 'tiktok', followers: 333444 }));
    expect(profiles.markFailed).not.toHaveBeenCalled();
  });

  it('aborta fail-closed quando o job não tem tenant_id', async () => {
    const profiles = { upsertPending: jest.fn(), upsertSuccess: jest.fn(), markFailed: jest.fn() };
    const dbContext = makeDbContext();
    const processor = new ArtistPlatformSyncProcessor(
      { getRepository: jest.fn() } as never,
      profiles as never,
      dbContext as never,
      { platform: 'spotify' } as never,
      { platform: 'youtube' } as never,
      { platform: 'deezer' } as never,
      { platform: 'soundcloud' } as never,
      { platform: 'instagram' } as never,
      { platform: 'tiktok' } as never,
      { platform: 'apple-music' } as never,
    );

    await processor.process({
      name: ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC,
      data: { ...payload, tenant_id: '' },
    } as never);

    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(profiles.upsertPending).not.toHaveBeenCalled();
  });
});
