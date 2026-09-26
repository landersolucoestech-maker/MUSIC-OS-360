import { ArtistPlatformProfilesService } from './artist-platform-profiles.service';
import type { SocialPlatformProfileSnapshot } from './social-platform-sync.types';

function buildQb() {
  const qb: any = {
    insert: jest.fn(),
    into: jest.fn(),
    values: jest.fn(),
    orUpdate: jest.fn(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  qb.insert.mockReturnValue(qb);
  qb.into.mockReturnValue(qb);
  qb.values.mockReturnValue(qb);
  qb.orUpdate.mockReturnValue(qb);
  return qb;
}

function buildRepo(qb: ReturnType<typeof buildQb>) {
  return {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn().mockResolvedValue(null),
  };
}

function buildNoopSnapshots() {
  return { recordFromProfileSnapshot: jest.fn().mockResolvedValue({ inserted: 0, skipped: 0 }) } as never;
}

function baseSnapshot(overrides: Partial<SocialPlatformProfileSnapshot>): SocialPlatformProfileSnapshot {
  return {
    tenant_id: 't1',
    artist_id: 'a1',
    platform: 'soundcloud',
    external_id: 'slug',
    external_url: 'https://soundcloud.com/slug',
    display_name: null,
    username: 'slug',
    profile_url: 'https://soundcloud.com/slug',
    image_url: null,
    followers: null,
    subscribers: null,
    monthly_listeners: null,
    popularity: null,
    total_views: null,
    total_videos: null,
    total_tracks: null,
    total_albums: null,
    raw_payload: {},
    sync_status: 'success',
    last_synced_at: null,
    last_error: null,
    ...overrides,
  };
}

// REGRESSION (found while validating in real production with real data — Metrics Phase 1):
// upsertSuccess() overwrote sync_status/last_error with fixed values ('success'/null),
// IGNORING what the provider actually decided. Result: an IDENTITY_MISMATCH snapshot
// (sync_status='failed', last_error explaining the mismatch) silently became
// sync_status='success' in the database — the wrong data was masked as success, exactly
// the opposite of what the identity protection should guarantee. Confirmed live: syncing
// the real Dj Stay SoundCloud (real Soundcharts, no mock) persisted followers=null +
// identity_status=IDENTITY_MISMATCH in raw_payload, but sync_status reached the API as
// 'success' — only discovered by running the real end-to-end flow, not by the providers'
// unit tests (which never go through the real upsert).
describe('ArtistPlatformProfilesService.upsertSuccess', () => {
  it('persists sync_status=success/last_error=null when the snapshot is a normal success', async () => {
    const qb = buildQb();
    const repo = buildRepo(qb);
    const service = new ArtistPlatformProfilesService({ getRepository: () => repo } as never, buildNoopSnapshots());

    const snapshot = baseSnapshot({ followers: 777, sync_status: 'success', last_error: null });
    await service.upsertSuccess(snapshot);

    const values = qb.values.mock.calls[0][0];
    expect(values.sync_status).toBe('success');
    expect(values.last_error).toBeNull();
    expect(values.followers).toBe(777);
  });

  it('NEVER overwrites sync_status=failed/last_error of an IDENTITY_MISMATCH snapshot — persists exactly what the provider decided', async () => {
    const qb = buildQb();
    const repo = buildRepo(qb);
    const service = new ArtistPlatformProfilesService({ getRepository: () => repo } as never, buildNoopSnapshots());

    const snapshot = baseSnapshot({
      followers: null,
      sync_status: 'failed',
      last_error: 'Identidade divergente: ... (IDENTITY_MISMATCH)',
      raw_payload: { identity_status: 'IDENTITY_MISMATCH', resolved_uuid: 'b-uuid', canonical_uuid: 'a-uuid' },
    });
    await service.upsertSuccess(snapshot);

    const values = qb.values.mock.calls[0][0];
    expect(values.sync_status).toBe('failed');
    expect(values.last_error).toContain('IDENTITY_MISMATCH');
    expect(values.followers).toBeNull();
    expect(values.raw_payload).toEqual(snapshot.raw_payload);
  });
});
