/**
 * queues/queue.module.ts
 *
 * Central BullMQ queue module of Music OS 360.
 *
 * register() is async: it tests the Redis connection with PING before enabling BullMQ.
 * If the connection fails (WRONGPASS, ECONNREFUSED, timeout), it falls back to no-op mode:
 *   - BullModule is NOT imported (no internal RedisConnection is created)
 *   - Workers (processors) are NOT registered
 *   - Producer services are registered but @Optional() @InjectQueue
 *     resolves to null → enqueue methods are an explicit no-op
 */

import { DynamicModule, Global, Module, Logger } from '@nestjs/common';
import { DiscoveryModule }          from '@nestjs/core';
import { BullModule }              from '@nestjs/bullmq';
import { QUEUE_NAMES }             from './queue.constants';
import { WorkerErrorThrottlerService } from './worker-error-throttler.service';

import { EmailProcessor }           from './processors/email.processor';
import { NotificationsProcessor }   from './processors/notifications.processor';
import { AIJobsProcessor }          from './processors/ai-jobs.processor';
import { ExternalDataProcessor }    from './processors/external-data.processor';
import { MarketingPublishingProcessor } from './processors/marketing-publishing.processor';
import { ArtistPlatformSyncProcessor } from './processors/artist-platform-sync.processor';
import { MarketBenchmarkRefreshProcessor } from './processors/market-benchmark-refresh.processor';

import { EmailQueueService }         from './services/email-queue.service';
import { NotificationsQueueService } from './services/notifications-queue.service';
import { AIJobsQueueService }        from './services/ai-jobs-queue.service';
import { WorkflowQueueService }      from './services/workflow-queue.service';
import { MarketingPublishingQueueService } from './services/marketing-publishing-queue.service';
import { MarketBenchmarkRefreshQueueService } from './services/market-benchmark-refresh-queue.service';
import { ArtistPlatformProfilesService } from '../modules/artists/platform-profiles/artist-platform-profiles.service';
import { ArtistMetricSnapshotsService } from '../modules/artists/platform-profiles/artist-metric-snapshots.service';
import { MarketBenchmarkService } from '../modules/artists/platform-profiles/analytics/market-benchmark.service';
import { MarketReferenceCacheService } from '../modules/artists/platform-profiles/analytics/market-reference-cache.service';
import { SpotifyArtistProfileProvider } from '../modules/artists/platform-profiles/providers/spotify-artist-profile.provider';
import { YouTubeArtistProfileProvider } from '../modules/artists/platform-profiles/providers/youtube-artist-profile.provider';
import { DeezerArtistProfileProvider } from '../modules/artists/platform-profiles/providers/deezer-artist-profile.provider';
import { SoundCloudArtistProfileProvider } from '../modules/artists/platform-profiles/providers/soundcloud-artist-profile.provider';
import { InstagramArtistProfileProvider } from '../modules/artists/platform-profiles/providers/instagram-artist-profile.provider';
import { TikTokArtistProfileProvider } from '../modules/artists/platform-profiles/providers/tiktok-artist-profile.provider';
import { AppleMusicArtistProfileProvider } from '../modules/artists/platform-profiles/providers/apple-music-artist-profile.provider';
import { SoundchartsService } from '../modules/integrations/soundcharts/soundcharts.service';

import { CoreModule }  from '../core/core.module';
import { AIModule }    from '../modules/ai/ai.module';

const moduleLogger = new Logger('QueueModule');
const REDIS_ERROR_LOG_INTERVAL_MS = 30_000;

function createRedisErrorLogger() {
  let lastCode = '';
  let lastLogAt = 0;

  return (err: NodeJS.ErrnoException) => {
    const now = Date.now();
    const code = err.code ?? err.message?.split('\n')[0] ?? 'UNKNOWN';
    if (code !== lastCode || now - lastLogAt >= REDIS_ERROR_LOG_INTERVAL_MS) {
      lastCode = code;
      lastLogAt = now;
      moduleLogger.warn(`Redis indisponivel (${code}); BullMQ aguardando reconnect`);
    }
  };
}

function createRedisReconnectLogger() {
  let lastLogAt = 0;

  return (delay: number) => {
    const now = Date.now();
    if (now - lastLogAt >= REDIS_ERROR_LOG_INTERVAL_MS) {
      lastLogAt = now;
      moduleLogger.warn(`Redis reconectando em ${delay}ms`);
    }
  };
}

function buildRedisUrlFromParts(): string | undefined {
  const host = process.env['REDIS_HOST'];
  if (!host) return undefined;

  const port = process.env['REDIS_PORT'] || '6379';
  const password = process.env['REDIS_PASSWORD'];
  const auth = password ? `:${encodeURIComponent(password)}@` : '';
  return `redis://${auth}${host}:${port}`;
}

function resolveRedisUrl(): string | undefined {
  return process.env['REDIS_QUEUE_URL'] || process.env['REDIS_URL'] || buildRedisUrlFromParts();
}

function isIoRedisUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (!url.startsWith('redis://') && !url.startsWith('rediss://')) return false;
  if (url.includes('railway.internal')) return false;
  return true;
}

/** Tests whether the Redis URL and commands are really reachable. Returns false on failure. */
async function probeRedis(url: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require('ioredis') as { Redis: new (url: string, opts: object) => import('ioredis').Redis };
  const probe = new Redis(url, {
    lazyConnect:          true,
    enableReadyCheck:     false,
    enableOfflineQueue:   false,
    connectTimeout:       4000,
    maxRetriesPerRequest: 0,
    retryStrategy:        () => null,
  });

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      probe.disconnect(false);
      resolve(ok);
    };

    const timer = setTimeout(() => {
      moduleLogger.warn('Redis: timeout na conexão de teste — BullMQ desativado');
      done(false);
    }, 5000);

    probe.on('ready', async () => {
      try {
        await probe.ping();
        await probe.eval('return 1', 0);
        clearTimeout(timer);
        done(true);
      } catch (err: unknown) {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : String(err);
        moduleLogger.warn(`Redis indisponivel para comandos: ${message.split('\n')[0]} - BullMQ desativado`);
        done(false);
      }
    });
    probe.on('error', (err: Error) => {
      clearTimeout(timer);
      moduleLogger.warn(`Redis inacessível: ${err.message?.split('\n')[0]} — BullMQ desativado`);
      done(false);
    });

    probe.connect().catch(() => { /* handled by 'error' event */ });
  });
}

/**
 * SINGLE (memoized) decision on BullMQ availability at boot.
 * Shared by QueueModule and AdminQueuesModule so the Bull Board
 * is never mounted when the queues are in no-op mode (Redis missing/down).
 */
let bullAvailability: Promise<boolean> | undefined;
export function bullMqAvailable(): Promise<boolean> {
  bullAvailability ??= (async () => {
    const url = resolveRedisUrl();
    if (!isIoRedisUrl(url)) return false;
    return probeRedis(url!);
  })();
  return bullAvailability;
}

const ALL_QUEUES = [
  QUEUE_NAMES.EMAILS,
  QUEUE_NAMES.NOTIFICATIONS,
  QUEUE_NAMES.AI_JOBS,
  QUEUE_NAMES.INTEGRATIONS_SYNC,
  QUEUE_NAMES.STREAMING_SYNC,
  QUEUE_NAMES.MARKETING_PUBLISHING,
  QUEUE_NAMES.ARTIST_PLATFORM_SYNC,
  QUEUE_NAMES.ANALYTICS_REFRESH,
];

@Global()
@Module({})
export class QueueModule {
  private static noOpModule(): DynamicModule {
    const services = [EmailQueueService, NotificationsQueueService, AIJobsQueueService, WorkflowQueueService, MarketingPublishingQueueService, MarketBenchmarkRefreshQueueService];
    return {
      global:    true,
      module:    QueueModule,
      imports:   [],
      providers: services,
      exports:   services,
    };
  }

  static async register(): Promise<DynamicModule> {
    const url       = resolveRedisUrl();
    const isProd    = process.env['NODE_ENV'] === 'production';

    if (!isIoRedisUrl(url)) {
      if (isProd) {
        moduleLogger.error('REDIS_QUEUE_URL não configurado em produção — abortando startup');
        process.exit(1);
      }
      moduleLogger.warn('REDIS_QUEUE_URL não configurado — BullMQ desativado (modo no-op)');
      return QueueModule.noOpModule();
    }

    const ok = await bullMqAvailable();
    if (!ok) {
      if (isProd) {
        moduleLogger.error('Redis inacessível em produção — abortando startup');
        process.exit(1);
      }
      return QueueModule.noOpModule();
    }

    moduleLogger.log(`BullMQ activado — Redis: ${url!.substring(0, 40)}...`);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis    = require('ioredis');
    const logRedisError = createRedisErrorLogger();
    const logRedisReconnect = createRedisReconnectLogger();
    const connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck:     false,
      enableOfflineQueue:   false,
      lazyConnect:          true,
      retryStrategy: (times: number) => Math.min(times * 2000, 30_000),
    });

    connection.on('error', logRedisError);
    connection.on('ready', () => {
      moduleLogger.log('Redis pronto para BullMQ');
    });
    connection.on('reconnecting', logRedisReconnect);

    return {
      global: true,
      module: QueueModule,
      imports: [
        BullModule.forRoot({
          connection,
          defaultJobOptions: {
            attempts:         3,
            removeOnComplete: 100,
            removeOnFail:     1000,
            backoff: { type: 'exponential', delay: 3000 },
          },
        }),
        BullModule.registerQueue(...ALL_QUEUES.map((name) => ({ name }))),
        CoreModule,
        AIModule,
        DiscoveryModule,
      ],
      providers: [
        EmailQueueService,
        NotificationsQueueService,
        AIJobsQueueService,
        WorkflowQueueService,
        MarketingPublishingQueueService,
        MarketBenchmarkRefreshQueueService,
        EmailProcessor,
        NotificationsProcessor,
        AIJobsProcessor,
        ExternalDataProcessor,
        MarketingPublishingProcessor,
        ArtistPlatformSyncProcessor,
        MarketBenchmarkRefreshProcessor,
        WorkerErrorThrottlerService,
        ArtistPlatformProfilesService,
        // Phase 3.2 fix: the real dependency on ArtistPlatformProfilesService
        // (since Phase 2) had never been registered in this module —
        // real DI resolution of this module would break at app boot
        // (no existing test boots the real QueueModule with full DI
        // to catch it; found while adding the new processor).
        ArtistMetricSnapshotsService,
        MarketBenchmarkService,
        MarketReferenceCacheService,
        SoundchartsService,
        SpotifyArtistProfileProvider,
        YouTubeArtistProfileProvider,
        DeezerArtistProfileProvider,
        SoundCloudArtistProfileProvider,
        InstagramArtistProfileProvider,
        TikTokArtistProfileProvider,
        AppleMusicArtistProfileProvider,
      ],
      exports: [
        BullModule,
        EmailQueueService,
        NotificationsQueueService,
        AIJobsQueueService,
        WorkflowQueueService,
        MarketingPublishingQueueService,
        MarketBenchmarkRefreshQueueService,
      ],
    };
  }
}
