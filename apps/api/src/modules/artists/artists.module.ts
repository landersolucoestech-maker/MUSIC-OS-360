import { Module } from '@nestjs/common';
import { ArtistsController } from './artists.controller';
import { ArtistsService }    from './artists.service';
import { ArtistEventsHandler }  from './handlers/artist-events.handler';
import { ArtistWorkflowHandler } from './handlers/artist-workflow.handler';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { ArtistPlatformProfilesService } from './platform-profiles/artist-platform-profiles.service';
import { ArtistMetricSnapshotsService } from './platform-profiles/artist-metric-snapshots.service';
import { ArtistExternalProfileSyncService } from './platform-profiles/artist-external-profile-sync.service';
import { SpotifyArtistProfileProvider } from './platform-profiles/providers/spotify-artist-profile.provider';
import { YouTubeArtistProfileProvider } from './platform-profiles/providers/youtube-artist-profile.provider';
import { DeezerArtistProfileProvider } from './platform-profiles/providers/deezer-artist-profile.provider';
import { SoundCloudArtistProfileProvider } from './platform-profiles/providers/soundcloud-artist-profile.provider';
import { InstagramArtistProfileProvider } from './platform-profiles/providers/instagram-artist-profile.provider';
import { TikTokArtistProfileProvider } from './platform-profiles/providers/tiktok-artist-profile.provider';
import { AppleMusicArtistProfileProvider } from './platform-profiles/providers/apple-music-artist-profile.provider';
import { SoundchartsService } from '../integrations/soundcharts/soundcharts.service';
import { CareerStageService } from './platform-profiles/analytics/career-stage.service';
import { MarketBenchmarkService } from './platform-profiles/analytics/market-benchmark.service';
import { MarketReferenceCacheService } from './platform-profiles/analytics/market-reference-cache.service';
import { AIModule } from '../ai/ai.module';
import { AudienceHealthAutomation } from '../../core/automation/audience-health.automation';

@Module({
  imports:     [ActivityLogsModule, AIModule],
  controllers: [ArtistsController],
  providers:   [
    ArtistsService,
    ArtistEventsHandler,
    ArtistWorkflowHandler,
    ArtistPlatformProfilesService,
    ArtistMetricSnapshotsService,
    ArtistExternalProfileSyncService,
    SoundchartsService,
    SpotifyArtistProfileProvider,
    YouTubeArtistProfileProvider,
    DeezerArtistProfileProvider,
    SoundCloudArtistProfileProvider,
    InstagramArtistProfileProvider,
    TikTokArtistProfileProvider,
    AppleMusicArtistProfileProvider,
    CareerStageService,
    MarketBenchmarkService,
    MarketReferenceCacheService,
    AudienceHealthAutomation,
  ],
  exports:     [ArtistsService, ArtistPlatformProfilesService, ArtistMetricSnapshotsService, ArtistExternalProfileSyncService],
})
export class ArtistsModule {}
