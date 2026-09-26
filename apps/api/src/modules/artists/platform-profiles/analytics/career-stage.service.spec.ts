import { CareerStageService } from './career-stage.service';
import type { ArtistPlatformProfilesService } from '../artist-platform-profiles.service';
import type { ArtistMetricSnapshotsService } from '../artist-metric-snapshots.service';
import { METRIC_KEYS } from '../metric-keys';

function baseSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: 't1', artist_id: 'a1', platform: 'spotify', external_id: 'x', external_url: null,
    display_name: null, username: null, profile_url: null, image_url: null,
    followers: null, subscribers: null, monthly_listeners: null, popularity: null,
    total_views: null, total_videos: null, total_tracks: null, total_albums: null,
    raw_payload: {}, sync_status: 'success', last_synced_at: new Date('2026-08-31'), last_error: null,
    ...overrides,
  };
}

function buildInsertRepo(existingLatest: unknown = null) {
  const inserted: unknown[] = [];
  const repo = {
    insert: jest.fn(async (row: unknown) => { inserted.push(row); }),
    findOne: jest.fn().mockResolvedValue(existingLatest),
  };
  return { repo, inserted };
}

describe('CareerStageService.calculate', () => {
  it('calculates from already-ingested current-state + growth, without calling any external API (only the injected services)', async () => {
    const profiles = {
      findByArtist: jest.fn().mockResolvedValue([
        baseSnapshot({ platform: 'spotify', monthly_listeners: 1_000_000 }),
        baseSnapshot({ platform: 'instagram', followers: 500_000 }),
      ]),
    } as unknown as ArtistPlatformProfilesService;
    const snapshots = {
      history: jest.fn().mockResolvedValue([]),
      growth: jest.fn().mockResolvedValue({ status: 'INSUFFICIENT_HISTORY', periodDays: 30 }),
    } as unknown as ArtistMetricSnapshotsService;

    const { repo: fakeRepo } = buildInsertRepo();
    const ds = { getRepository: () => fakeRepo } as never;
    const service = new CareerStageService(ds, profiles, snapshots);

    const result = await service.calculate('t1', 'a1');

    expect(profiles.findByArtist).toHaveBeenCalledWith('t1', 'a1');
    expect(result.status).toBe('OK');
    expect(result.dimensions.find((d) => d.key === 'STREAMING')?.status).toBe('AVAILABLE');
  });

  it('persists an append-only snapshot per calculation (never UPDATE)', async () => {
    const profiles = {
      findByArtist: jest.fn().mockResolvedValue([baseSnapshot({ platform: 'spotify', monthly_listeners: 2_000_000 })]),
    } as unknown as ArtistPlatformProfilesService;
    const snapshots = {
      history: jest.fn().mockResolvedValue([]),
      growth: jest.fn().mockResolvedValue({ status: 'INSUFFICIENT_HISTORY', periodDays: 30 }),
    } as unknown as ArtistMetricSnapshotsService;

    const { repo: fakeRepo, inserted } = buildInsertRepo();
    const ds = { getRepository: () => fakeRepo } as never;
    const service = new CareerStageService(ds, profiles, snapshots);
    await service.calculate('t1', 'a1');

    expect(fakeRepo.insert).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveLength(1);
    const row = inserted[0] as { tenant_id: string; artist_id: string; engine_version: string };
    expect(row.tenant_id).toBe('t1');
    expect(row.artist_id).toBe('a1');
    expect(row.engine_version).toBe('1.1.0');
  });

  it('SNAPSHOT DEDUP (item 25/26): a result identical to the last snapshot does not write a new row on every GET', async () => {
    const profiles = {
      findByArtist: jest.fn().mockResolvedValue([baseSnapshot({ platform: 'spotify', monthly_listeners: 2_000_000 })]),
    } as unknown as ArtistPlatformProfilesService;
    const snapshots = {
      history: jest.fn().mockResolvedValue([]),
      growth: jest.fn().mockResolvedValue({ status: 'INSUFFICIENT_HISTORY', periodDays: 30 }),
    } as unknown as ArtistMetricSnapshotsService;

    const { repo: fakeRepo, inserted } = buildInsertRepo();
    const ds = { getRepository: () => fakeRepo } as never;
    const service = new CareerStageService(ds, profiles, snapshots);
    await service.calculate('t1', 'a1');
    expect(inserted).toHaveLength(1);

    // Second call with the SAME input (simulates 2 consecutive screen openings):
    // the fake repo returns the just-written snapshot via findOne — should skip the insert.
    (fakeRepo.findOne as jest.Mock).mockResolvedValue(inserted[0]);
    await service.calculate('t1', 'a1');
    expect(inserted).toHaveLength(1); // still 1 — did not duplicate

    // Third call with a DIFFERENT input (metric actually changed): should write.
    const profiles2 = {
      findByArtist: jest.fn().mockResolvedValue([baseSnapshot({ platform: 'spotify', monthly_listeners: 5_000_000 })]),
    } as unknown as ArtistPlatformProfilesService;
    const service2 = new CareerStageService(ds, profiles2, snapshots);
    await service2.calculate('t1', 'a1');
    expect(inserted).toHaveLength(2);
  });

  it('a persistence failure does not bring down the result (audit trail is best-effort)', async () => {
    const profiles = {
      findByArtist: jest.fn().mockResolvedValue([]),
    } as unknown as ArtistPlatformProfilesService;
    const snapshots = {
      history: jest.fn().mockResolvedValue([]),
      growth: jest.fn().mockResolvedValue({ status: 'INSUFFICIENT_HISTORY', periodDays: 30 }),
    } as unknown as ArtistMetricSnapshotsService;
    const repo = { insert: jest.fn().mockRejectedValue(new Error('db down')) };
    const ds = { getRepository: () => repo } as never;
    const service = new CareerStageService(ds, profiles, snapshots);

    const result = await service.calculate('t1', 'a1');
    expect(result.status).toBe('INSUFFICIENT_DATA');
  });

  it('ignores profiles with sync_status != success (pending/failed never feed the engine)', async () => {
    const profiles = {
      findByArtist: jest.fn().mockResolvedValue([
        baseSnapshot({ platform: 'spotify', monthly_listeners: 1_000_000, sync_status: 'failed' }),
      ]),
    } as unknown as ArtistPlatformProfilesService;
    const snapshots = {
      history: jest.fn().mockResolvedValue([]),
      growth: jest.fn().mockResolvedValue({ status: 'INSUFFICIENT_HISTORY', periodDays: 30 }),
    } as unknown as ArtistMetricSnapshotsService;
    const { repo: fakeRepo } = buildInsertRepo();
    const ds = { getRepository: () => fakeRepo } as never;
    const service = new CareerStageService(ds, profiles, snapshots);

    const result = await service.calculate('t1', 'a1');
    expect(result.dimensions.find((d) => d.key === 'STREAMING')?.status).toBe('UNAVAILABLE');
  });

  it('fetches growth for eligible metrics, never for apple-music (no audience history)', async () => {
    const profiles = { findByArtist: jest.fn().mockResolvedValue([]) } as unknown as ArtistPlatformProfilesService;
    const growthCalls: string[] = [];
    const snapshots = {
      history: jest.fn().mockResolvedValue([]),
      growth: jest.fn((input: { metric: string }) => {
        growthCalls.push(input.metric);
        return Promise.resolve({ status: 'INSUFFICIENT_HISTORY', periodDays: 30 });
      }),
    } as unknown as ArtistMetricSnapshotsService;
    const { repo: fakeRepo } = buildInsertRepo();
    const ds = { getRepository: () => fakeRepo } as never;
    const service = new CareerStageService(ds, profiles, snapshots);
    await service.calculate('t1', 'a1');

    expect(growthCalls).not.toContain(METRIC_KEYS.APPLE_MUSIC_PLAYLIST_COUNT);
    expect(growthCalls).toContain(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS);
  });
});
