import { BadRequestException, Inject, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { QUEUE_NAMES, ARTIST_PLATFORM_PROFILE_JOB_NAMES } from '../../../queues/queue.constants';
import { ArtistsService } from '../artists.service';
import type { ArtistEntity } from '../../../database/entities';
import { ArtistPlatformProfilesService } from './artist-platform-profiles.service';
import { SpotifyArtistProfileProvider } from './providers/spotify-artist-profile.provider';
import type { ArtistPlatformSyncJobPayload, SocialPlatform } from './social-platform-sync.types';
import { isSocialPlatform } from './social-platform-sync.types';
import { extractAppleMusicId } from './apple-music-url.util';
import { parseYoutubeRef } from './youtube-ref.util';

@Injectable()
export class ArtistExternalProfileSyncService {
  private readonly logger = new Logger(ArtistExternalProfileSyncService.name);

  constructor(
    private readonly artists: ArtistsService,
    private readonly profiles: ArtistPlatformProfilesService,
    private readonly spotifyProvider: SpotifyArtistProfileProvider,
    @Optional()
    @InjectQueue(QUEUE_NAMES.ARTIST_PLATFORM_SYNC)
    private readonly queue: Queue<ArtistPlatformSyncJobPayload> | null,
  ) {}

  async enqueueManualSync(input: {
    tenantId: string;
    artistId: string;
    platform: string;
    requestedBy: string;
    profileUrl?: string | null;
  }): Promise<{
    artist_id: string;
    enqueued: Array<{ platform: SocialPlatform; job_id: string }>;
    skipped: Array<{ platform: SocialPlatform; reason: string }>;
  }> {
    if (!isSocialPlatform(input.platform)) {
      throw new BadRequestException('Plataforma inválida para sync de perfil do artista');
    }

    const startedAt = Date.now();
    const artist = await this.artists.findById(input.tenantId, input.artistId);
    const platform = input.platform;
    const normalized = this.resolveExternalProfile({
      platform,
      profileUrl: input.profileUrl,
      cachedProfileUrl: this.cachedProfileUrlFor(platform, artist),
    });
    const externalId = normalized.externalId;
    const externalUrl = normalized.externalUrl;

    const logCtx =
      `tenant=${input.tenantId} artist=${input.artistId} platform=${platform} ` +
      `requestedBy=${input.requestedBy} externalId=${externalId ?? '-'} externalUrl=${externalUrl ?? '-'}`;
    this.logger.log(`[platform-sync/enqueue] solicitado ${logCtx}`);

    if (!externalId && !externalUrl) {
      this.logger.warn(`[platform-sync/enqueue] pulado reason=missing_external_profile ${logCtx}`);
      return {
        artist_id: input.artistId,
        enqueued: [],
        skipped: [{ platform, reason: 'missing_external_profile' }],
      };
    }

    // Spotify monthly listeners are a lightweight public-page lookup. Run it directly so
    // this metric does not depend on Redis/BullMQ being available in DEV.
    if (platform === 'spotify') {
      await this.profiles.upsertPending({
        tenantId: input.tenantId,
        artistId: input.artistId,
        platform,
        externalId,
        externalUrl,
      });

      try {
        const snapshot = await this.spotifyProvider.resolve({
          tenantId: input.tenantId,
          artistId: input.artistId,
          externalId,
          externalUrl,
        });
        await this.profiles.upsertSuccess(snapshot);
        this.logger.log(
          `[platform-sync/direct] Spotify concluído monthly_listeners=${snapshot.monthly_listeners ?? '-'} latency_ms=${Date.now() - startedAt} ${logCtx}`,
        );
        return {
          artist_id: input.artistId,
          enqueued: [{ platform, job_id: `direct-${Date.now()}` }],
          skipped: [],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.profiles.markFailed({
          tenantId: input.tenantId,
          artistId: input.artistId,
          platform,
          externalId,
          externalUrl,
          error: message,
        });
        this.logger.error(`[platform-sync/direct] Spotify falhou: ${message} ${logCtx}`);
        throw err;
      }
    }

    if (await this.profiles.hasRecentPending(input.tenantId, input.artistId, platform)) {
      this.logger.warn(`[platform-sync/enqueue] pulado reason=pending_sync_exists ${logCtx}`);
      return {
        artist_id: input.artistId,
        enqueued: [],
        skipped: [{ platform, reason: 'pending_sync_exists' }],
      };
    }

    if (!this.queue) {
      // find (distributed-systems-reviewer, Bug 1): this used to write
      // sync_status='pending' here even though NOTHING will ever process
      // it (there is no queue) — an orphan row that never transitions to
      // failed/success on its own. There is nothing to persist: the
      // operation failed outright, so it throws with no DB write at all.
      this.logger.error(`[platform-sync/enqueue] fila BullMQ indisponível (Redis off/no-op) ${logCtx}`);
      throw new ServiceUnavailableException(
        `Fila de sincronização indisponível: BullMQ está em modo no-op (Redis inacessível ou REDIS_QUEUE_URL ausente) — sync de ${platform} não pôde ser enfileirado`,
      );
    }

    const payload: ArtistPlatformSyncJobPayload = {
      tenant_id: input.tenantId,
      artist_id: input.artistId,
      platform,
      external_id: externalId,
      external_url: externalUrl,
      requested_by: input.requestedBy,
      reason: 'manual',
      idempotency_key: this.buildIdempotencyKey(input.tenantId, input.artistId, platform, externalId ?? externalUrl ?? ''),
    };

    const jobOptions: Parameters<Queue<ArtistPlatformSyncJobPayload>['add']>[2] = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
      jobId: payload.idempotency_key,
    };

    // find (distributed-systems-reviewer, Bug 1): `upsertPending` used to
    // run BEFORE `queue.add()`. If `add()` then threw, the 'pending' row
    // was already persisted with no job anywhere to ever resolve it —
    // an orphan that `hasRecentPending`'s 2-minute TTL only half-heals
    // (unblocks retries after 2min, but the stale row itself never
    // transitions to failed/success).
    //
    // find-2d37d50a (backend-reviewer, follow-up): moving the write to
    // AFTER a successful `queue.add()` created a *second* race — the
    // worker (`ArtistPlatformSyncProcessor.processInTenantContext`) also
    // calls `upsertPending` at job start, and on a fast/local queue it can
    // finish the whole sync (upsertSuccess/markFailed) before this
    // producer-side call below ever ran, which would then overwrite a
    // definitive success/failed row back to 'pending' with nothing left
    // to resolve it. Fix: the worker is the SOLE writer of 'pending' for
    // the queued path (it already does this unconditionally at job
    // start) — the producer does not write it at all here. BullMQ's own
    // `jobId` dedup (`payload.idempotency_key`, deterministic per
    // tenant+artist+platform+externalRef) still prevents a genuine
    // duplicate enqueue regardless of what `hasRecentPending` currently
    // reads.
    let job;
    try {
      job = await this.queue.add(ARTIST_PLATFORM_PROFILE_JOB_NAMES.SYNC, payload, jobOptions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[platform-sync/enqueue] BullMQ add falhou: ${message} jobId=${payload.idempotency_key} ${logCtx}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new ServiceUnavailableException(
        `Falha ao enfileirar sincronização de ${platform} no BullMQ: ${message}`,
      );
    }

    this.logger.log(
      `[platform-sync/enqueue] enfileirado job=${String(job.id)} latency_ms=${Date.now() - startedAt} ${logCtx}`,
    );

    return {
      artist_id: input.artistId,
      enqueued: [{ platform, job_id: String(job.id) }],
      skipped: [],
    };
  }

  /**
   * instagram_url/tiktok_url não são colunas reais de ArtistEntity — vivem em
   * `artists.metadata` (jsonb), como todo campo do formulário fora do núcleo
   * canônico (ver report-form-contracts.ts, storage: 'metadata'). apple_music_url
   * já é coluna dedicada (igual spotify/youtube/deezer/soundcloud).
   */
  private cachedProfileUrlFor(platform: SocialPlatform, artist: ArtistEntity): string | null {
    if (platform === 'spotify') return artist.spotify_url;
    if (platform === 'deezer') return artist.deezer_url;
    if (platform === 'soundcloud') return artist.soundcloud_url;
    if (platform === 'youtube') return artist.youtube_url;
    if (platform === 'apple-music') return artist.apple_music_url;
    if (platform === 'instagram') return this.metadataUrl(artist, 'instagram_url');
    if (platform === 'tiktok') return this.metadataUrl(artist, 'tiktok_url');
    return null;
  }

  private metadataUrl(artist: ArtistEntity, field: string): string | null {
    const value = artist.metadata?.[field];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private resolveExternalProfile(input: {
    platform: SocialPlatform;
    profileUrl?: string | null;
    cachedProfileUrl?: string | null;
  }): { externalId: string | null; externalUrl: string | null } {
    const rawUrl = input.profileUrl?.trim() ?? '';
    if (rawUrl) {
      if (input.platform === 'spotify') {
        const externalId = this.extractSpotifyArtistId(rawUrl);
        if (!externalId) throw new BadRequestException('Link do Spotify inválido: informe uma URL de artista do Spotify');
        return {
          externalId,
          externalUrl: `https://open.spotify.com/artist/${externalId}`,
        };
      }

      if (input.platform === 'deezer') {
        const externalId = this.extractDeezerArtistId(rawUrl);
        if (!externalId) throw new BadRequestException('Link do Deezer inválido: informe uma URL de artista do Deezer');
        return {
          externalId,
          externalUrl: `https://www.deezer.com/artist/${externalId}`,
        };
      }

      if (input.platform === 'soundcloud') {
        const externalId = this.extractSoundCloudSlug(rawUrl);
        if (!externalId) throw new BadRequestException('Link do SoundCloud inválido: informe a URL do perfil do artista no SoundCloud');
        return {
          externalId,
          externalUrl: `https://soundcloud.com/${externalId}`,
        };
      }

      if (input.platform === 'instagram') {
        const externalId = this.extractInstagramUsername(rawUrl);
        if (!externalId) throw new BadRequestException('Link do Instagram inválido: informe a URL do perfil do artista no Instagram');
        return {
          externalId,
          externalUrl: `https://www.instagram.com/${externalId}`,
        };
      }

      if (input.platform === 'tiktok') {
        const externalId = this.extractTikTokUsername(rawUrl);
        if (!externalId) throw new BadRequestException('Link do TikTok inválido: informe a URL do perfil do artista no TikTok');
        return {
          externalId,
          externalUrl: `https://www.tiktok.com/@${externalId}`,
        };
      }

      if (input.platform === 'apple-music') {
        const externalId = extractAppleMusicId(rawUrl);
        if (!externalId) throw new BadRequestException('Link do Apple Music inválido: informe a URL do artista no Apple Music');
        return {
          externalId,
          externalUrl: `https://music.apple.com/artist/${externalId}`,
        };
      }

      const resolved = this.resolveYoutubeRef(rawUrl);
      if (!resolved) {
        throw new BadRequestException('Link do YouTube inválido: informe um @handle, um channelId UC... ou a URL do canal');
      }
      return resolved;
    }

    const cachedProfileUrl = input.cachedProfileUrl?.trim() ?? '';
    if (!cachedProfileUrl) return { externalId: null, externalUrl: null };
    if (input.platform === 'spotify') {
      const externalId = this.extractSpotifyArtistId(cachedProfileUrl);
      return {
        externalId,
        externalUrl: externalId ? `https://open.spotify.com/artist/${externalId}` : cachedProfileUrl,
      };
    }
    if (input.platform === 'deezer') {
      const externalId = this.extractDeezerArtistId(cachedProfileUrl);
      return {
        externalId,
        externalUrl: externalId ? `https://www.deezer.com/artist/${externalId}` : cachedProfileUrl,
      };
    }
    if (input.platform === 'soundcloud') {
      const externalId = this.extractSoundCloudSlug(cachedProfileUrl);
      return {
        externalId,
        externalUrl: externalId ? `https://soundcloud.com/${externalId}` : cachedProfileUrl,
      };
    }
    if (input.platform === 'instagram') {
      const externalId = this.extractInstagramUsername(cachedProfileUrl);
      return {
        externalId,
        externalUrl: externalId ? `https://www.instagram.com/${externalId}` : cachedProfileUrl,
      };
    }
    if (input.platform === 'tiktok') {
      const externalId = this.extractTikTokUsername(cachedProfileUrl);
      return {
        externalId,
        externalUrl: externalId ? `https://www.tiktok.com/@${externalId}` : cachedProfileUrl,
      };
    }
    if (input.platform === 'apple-music') {
      const externalId = extractAppleMusicId(cachedProfileUrl);
      return {
        externalId,
        externalUrl: externalId ? `https://music.apple.com/artist/${externalId}` : cachedProfileUrl,
      };
    }
    const resolved = this.resolveYoutubeRef(cachedProfileUrl);
    return {
      externalId: resolved?.externalId ?? null,
      externalUrl: resolved?.externalUrl ?? cachedProfileUrl,
    };
  }

  private extractSpotifyArtistId(value: string): string | null {
    const trimmed = value.trim();
    if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/([A-Za-z0-9]{22})(?:[/?#].*)?$/i);
    return match?.[1] ?? null;
  }

  private extractDeezerArtistId(value: string): string | null {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d+)/i);
    return match?.[1] ?? null;
  }

  /** Só aceita URLs de perfil (um único segmento), nunca faixa/playlist
   * (`soundcloud.com/user/track-slug`) — evita sincronizar o recurso errado. */
  private extractSoundCloudSlug(value: string): string | null {
    const trimmed = value.trim();
    if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i);
    return match?.[1] ?? null;
  }

  private extractInstagramUsername(value: string): string | null {
    const trimmed = value.trim();
    if (/^[A-Za-z0-9._]{1,30}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i);
    return match?.[1] ?? null;
  }

  private extractTikTokUsername(value: string): string | null {
    const trimmed = value.trim().replace(/^@/, '');
    if (/^[A-Za-z0-9._]{1,24}$/.test(trimmed)) return trimmed;
    const match = value.trim().match(/^https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{1,24})\/?(?:[?#].*)?$/i);
    return match?.[1] ?? null;
  }

  /**
   * find-eb3c5c45-class: this used to hand-roll a regex accepting only a
   * bare/`/channel/` `UC…` id — narrower than what
   * `YouTubeArtistProfileProvider.parseRef`/`resolveChannelId` can actually
   * resolve (also `@handle`, `/@handle`, `/user/NAME`, `/c/NAME`), so a
   * valid `@handle` saved by the form was rejected here at manual-sync time.
   * Now delegates to the same canonical parser (`youtube-ref.util.ts`).
   * `kind==='id'` resolves synchronously to a channel URL; the other kinds
   * (handle/username/custom) can't be resolved to a concrete channel id
   * without the YouTube Data API call the async worker already makes
   * (`provider.resolve` re-parses from `external_id ?? external_url`), so
   * they're passed through as `externalUrl` for the worker to resolve.
   */
  private resolveYoutubeRef(value: string): { externalId: string | null; externalUrl: string } | null {
    const ref = parseYoutubeRef(value);
    if (!ref) return null;
    if (ref.kind === 'id') {
      return { externalId: ref.value, externalUrl: `https://www.youtube.com/channel/${ref.value}` };
    }
    const trimmed = value.trim();
    return {
      externalId: null,
      externalUrl: /^https?:\/\//i.test(trimmed) ? trimmed : `https://www.youtube.com/@${ref.value}`,
    };
  }

  private buildIdempotencyKey(
    tenantId: string,
    artistId: string,
    platform: SocialPlatform,
    externalRef: string,
  ): string {
    const hash = createHash('sha256').update(externalRef).digest('hex').slice(0, 24);
    // BullMQ proíbe ':' em jobId customizado (separador de chaves Redis) —
    // Job.validateOptions lança "Custom Id cannot contain :". Usar '__'.
    return `${tenantId}__${artistId}__${platform}__manual__${hash}`;
  }
}
