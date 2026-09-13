import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { ARTIST_PLATFORM_PROFILE_JOB_NAMES, QUEUE_NAMES } from '../queue.constants';
import { ArtistEntity } from '../../database/entities';
import { ArtistPlatformProfilesService } from '../../modules/artists/platform-profiles/artist-platform-profiles.service';
import type {
  ArtistPlatformProvider,
  ArtistPlatformSyncJobPayload,
  SocialPlatform,
} from '../../modules/artists/platform-profiles/social-platform-sync.types';
import { SpotifyArtistProfileProvider } from '../../modules/artists/platform-profiles/providers/spotify-artist-profile.provider';
import { YouTubeArtistProfileProvider } from '../../modules/artists/platform-profiles/providers/youtube-artist-profile.provider';
import { DeezerArtistProfileProvider } from '../../modules/artists/platform-profiles/providers/deezer-artist-profile.provider';
import { SoundCloudArtistProfileProvider } from '../../modules/artists/platform-profiles/providers/soundcloud-artist-profile.provider';
import { InstagramArtistProfileProvider } from '../../modules/artists/platform-profiles/providers/instagram-artist-profile.provider';
import { TikTokArtistProfileProvider } from '../../modules/artists/platform-profiles/providers/tiktok-artist-profile.provider';
import { AppleMusicArtistProfileProvider } from '../../modules/artists/platform-profiles/providers/apple-music-artist-profile.provider';
import { canonicalUrlsFromArtist } from '../../modules/artists/platform-profiles/soundcharts-canonical-candidates.util';

@Processor(QUEUE_NAMES.ARTIST_PLATFORM_SYNC)
@Injectable()
export class ArtistPlatformSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ArtistPlatformSyncProcessor.name);
  private readonly providers: Record<SocialPlatform, ArtistPlatformProvider>;

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    private readonly profiles: ArtistPlatformProfilesService,
    private readonly dbContext: DatabaseContextService,
    spotify: SpotifyArtistProfileProvider,
    youtube: YouTubeArtistProfileProvider,
    deezer: DeezerArtistProfileProvider,
    soundcloud: SoundCloudArtistProfileProvider,
    instagram: InstagramArtistProfileProvider,
    tiktok: TikTokArtistProfileProvider,
    appleMusic: AppleMusicArtistProfileProvider,
  ) {
    super();
    this.providers = {
      spotify,
      youtube,
      deezer,
      soundcloud,
      instagram,
      tiktok,
      'apple-music': appleMusic,
    };
  }

  async process(job: Job<ArtistPlatformSyncJobPayload>): Promise<void> {
    if (job.name !== ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC) return;

    const payload = job.data;
    // Fail-closed: job assíncrono sem tenant NUNCA toca dados tenant-scoped.
    if (!payload.tenant_id) {
      this.logger.warn(`[artist-platform-sync] job=${job.id} sem tenant_id — abortado (fail-closed)`);
      return;
    }

    const provider = this.providers[payload.platform];
    if (!provider) {
      this.logger.warn(`[artist-platform-sync] provider unavailable platform=${payload.platform}`);
      return;
    }

    // P2-5: todas as escritas do worker rodam dentro do contexto de tenant —
    // as tabelas têm FORCE RLS com policy em private_get_tenant_id(); sem o
    // set_config da sessão o INSERT/UPDATE é negado pelo Postgres.
    await this.dbContext.runInTenantContext(
      { tenantId: payload.tenant_id, orgId: null, role: null },
      () => this.processInTenantContext(job, payload, provider),
    );
  }

  private async processInTenantContext(
    job: Job<ArtistPlatformSyncJobPayload>,
    payload: ArtistPlatformSyncJobPayload,
    provider: ArtistPlatformProvider,
  ): Promise<void> {
    const startedAt = Date.now();
    const logCtx =
      `job=${job.id} tenant=${payload.tenant_id} artist=${payload.artist_id} ` +
      `platform=${payload.platform} externalId=${payload.external_id ?? '-'} ` +
      `externalUrl=${payload.external_url ?? '-'} requestedBy=${payload.requested_by ?? '-'}`;
    this.logger.log(`[artist-platform-sync] iniciado ${logCtx}`);

    await this.profiles.upsertPending({
      tenantId: payload.tenant_id,
      artistId: payload.artist_id,
      platform: payload.platform,
      externalId: payload.external_id ?? null,
      externalUrl: payload.external_url ?? null,
    });

    try {
      const artist = await this.ds?.getRepository(ArtistEntity).findOne({
        where: { id: payload.artist_id, tenant_id: payload.tenant_id, deleted_at: null } as never,
      });
      if (!artist) {
        await this.profiles.markFailed({
          tenantId: payload.tenant_id,
          artistId: payload.artist_id,
          platform: payload.platform,
          externalId: payload.external_id ?? null,
          externalUrl: payload.external_url ?? null,
          error: 'Artista não encontrado',
        });
        this.logger.warn(`[artist-platform-sync] artista não encontrado ${logCtx}`);
        return;
      }
      if (!payload.external_id && !payload.external_url) {
        await this.profiles.markFailed({
          tenantId: payload.tenant_id,
          artistId: payload.artist_id,
          platform: payload.platform,
          externalId: payload.external_id ?? null,
          externalUrl: payload.external_url ?? null,
          error: 'Perfil externo ausente no artista',
        });
        this.logger.warn(`[artist-platform-sync] perfil externo ausente ${logCtx}`);
        return;
      }

      const snapshot = await provider.resolve({
        tenantId: payload.tenant_id,
        artistId: payload.artist_id,
        externalId: payload.external_id ?? null,
        externalUrl: payload.external_url ?? null,
        canonicalUrls: canonicalUrlsFromArtist(artist),
      });
      await this.profiles.upsertSuccess(snapshot);
      this.logger.log(
        `[artist-platform-sync] success followers=${snapshot.followers ?? '-'} ` +
          `subscribers=${snapshot.subscribers ?? '-'} latency_ms=${Date.now() - startedAt} ${logCtx}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.profiles.markFailed({
        tenantId: payload.tenant_id,
        artistId: payload.artist_id,
        platform: payload.platform,
        externalId: payload.external_id ?? null,
        externalUrl: payload.external_url ?? null,
        error: message,
      });
      this.logger.warn(
        `[artist-platform-sync] failed error="${message}" latency_ms=${Date.now() - startedAt} ${logCtx}`,
        err instanceof Error ? err.stack : undefined,
      );
      // find (distributed-systems-reviewer, Bug 2): swallowing this instead
      // of rethrowing made process() always resolve, so BullMQ always saw
      // the job as 'completed' — attempts:3/backoff (configured by the
      // producer) never engaged, a transient failure (network, 429, 5xx)
      // became permanent on the first try. sync_status is already
      // persisted as 'failed' by markFailed above regardless of outcome;
      // rethrowing only controls whether BullMQ retries the JOB, and lets
      // a genuinely exhausted job surface as 'failed' in Redis too
      // (removeOnFail:false, mirrors market-benchmark-refresh.processor.ts).
      throw err;
    }
  }
}
