import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { ArtistPlatformProfileEntity } from '../../../database/entities';
import type { SocialPlatform, SocialPlatformProfileSnapshot } from './social-platform-sync.types';
import { toSocialPlatformSnapshot } from './social-platform-sync.types';
import { ArtistMetricSnapshotsService } from './artist-metric-snapshots.service';

@Injectable()
export class ArtistPlatformProfilesService {
  private readonly logger = new Logger(ArtistPlatformProfilesService.name);
  private readonly repo: Repository<ArtistPlatformProfileEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly snapshots: ArtistMetricSnapshotsService,
  ) {
    if (ds) this.repo = ds.getRepository(ArtistPlatformProfileEntity);
  }

  private requireRepo(): Repository<ArtistPlatformProfileEntity> {
    if (!this.repo) throw new ServiceUnavailableException('Artist platform profile persistence unavailable');
    return this.repo;
  }

  async findByArtist(tenantId: string, artistId: string): Promise<SocialPlatformProfileSnapshot[]> {
    const rows = await this.requireRepo().find({
      where: { tenant_id: tenantId, artist_id: artistId } as never,
      order: { platform: 'ASC' } as never,
    });
    return rows.map(toSocialPlatformSnapshot);
  }

  async findByArtistAndPlatform(
    tenantId: string,
    artistId: string,
    platform: SocialPlatform,
  ): Promise<SocialPlatformProfileSnapshot | null> {
    const row = await this.requireRepo().findOne({
      where: { tenant_id: tenantId, artist_id: artistId, platform } as never,
    });
    return row ? toSocialPlatformSnapshot(row) : null;
  }

  async hasRecentPending(
    tenantId: string,
    artistId: string,
    platform: SocialPlatform,
    windowMs = 2 * 60 * 1000,
  ): Promise<boolean> {
    const row = await this.requireRepo().findOne({
      where: { tenant_id: tenantId, artist_id: artistId, platform } as never,
    });
    if (!row || row.sync_status !== 'pending') return false;
    return Date.now() - row.updated_at.getTime() < windowMs;
  }

  async upsertPending(input: {
    tenantId: string;
    artistId: string;
    platform: SocialPlatform;
    externalId?: string | null;
    externalUrl?: string | null;
  }): Promise<SocialPlatformProfileSnapshot> {
    const repo = this.requireRepo();
    const now = new Date();
    await repo
      .createQueryBuilder()
      .insert()
      .into(ArtistPlatformProfileEntity)
      .values({
        tenant_id: input.tenantId,
        artist_id: input.artistId,
        platform: input.platform,
        external_id: input.externalId ?? null,
        external_url: input.externalUrl ?? null,
        sync_status: 'pending',
        last_error: null,
        raw_payload: {},
        updated_at: now,
      } as never)
      .orUpdate(
        ['external_id', 'external_url', 'sync_status', 'last_error', 'updated_at'],
        ['tenant_id', 'artist_id', 'platform'],
      )
      .execute();

    return (await this.findByArtistAndPlatform(input.tenantId, input.artistId, input.platform))!;
  }

  /**
   * Persists the snapshot returned by a provider that did NOT throw —
   * which includes both sync_status='success' (normal path) and
   * sync_status='failed' with a diagnostic raw_payload (e.g. identity_status:
   * 'IDENTITY_MISMATCH' in soundcharts-canonical-candidates.util.ts), when the
   * provider detects a problem but does not want to throw (to preserve the
   * specific raw_payload/last_error). NEVER overwrites the snapshot's
   * sync_status/last_error — respecting exactly what the provider decided is
   * what makes IDENTITY_MISMATCH visible in the database instead of masked as
   * 'success' (Metrics Phase 1).
   */
  async upsertSuccess(snapshot: SocialPlatformProfileSnapshot): Promise<SocialPlatformProfileSnapshot> {
    const repo = this.requireRepo();
    const now = new Date();
    await repo
      .createQueryBuilder()
      .insert()
      .into(ArtistPlatformProfileEntity)
      .values({
        ...snapshot,
        last_synced_at: now,
        updated_at: now,
      } as never)
      .orUpdate(
        [
          'external_id',
          'external_url',
          'display_name',
          'username',
          'profile_url',
          'image_url',
          'followers',
          'subscribers',
          'monthly_listeners',
          'popularity',
          'total_views',
          'total_videos',
          'total_tracks',
          'total_albums',
          'raw_payload',
          'sync_status',
          'last_synced_at',
          'last_error',
          'updated_at',
        ],
        ['tenant_id', 'artist_id', 'platform'],
      )
      .execute();

    // Phase 2 — writes the real historical series from the SAME snapshot already
    // validated by the provider (never a second Soundcharts call).
    // Must never break the current-state update above: a failure here is
    // logged, not propagated — history is additive, current state is the
    // primary guarantee of this call.
    try {
      await this.snapshots.recordFromProfileSnapshot(snapshot);
    } catch (err) {
      this.logger.error(
        `[metric-snapshot] falha ao gravar histórico (current-state OK) tenant=${snapshot.tenant_id} artist=${snapshot.artist_id} platform=${snapshot.platform}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return (await this.findByArtistAndPlatform(snapshot.tenant_id, snapshot.artist_id, snapshot.platform))!;
  }

  async markFailed(input: {
    tenantId: string;
    artistId: string;
    platform: SocialPlatform;
    externalId?: string | null;
    externalUrl?: string | null;
    error: string;
  }): Promise<SocialPlatformProfileSnapshot> {
    const repo = this.requireRepo();
    const now = new Date();
    await repo
      .createQueryBuilder()
      .insert()
      .into(ArtistPlatformProfileEntity)
      .values({
        tenant_id: input.tenantId,
        artist_id: input.artistId,
        platform: input.platform,
        external_id: input.externalId ?? null,
        external_url: input.externalUrl ?? null,
        sync_status: 'failed',
        last_error: input.error.slice(0, 2000),
        last_synced_at: now,
        updated_at: now,
      } as never)
      .orUpdate(
        ['external_id', 'external_url', 'sync_status', 'last_error', 'last_synced_at', 'updated_at'],
        ['tenant_id', 'artist_id', 'platform'],
      )
      .execute();

    return (await this.findByArtistAndPlatform(input.tenantId, input.artistId, input.platform))!;
  }
}
