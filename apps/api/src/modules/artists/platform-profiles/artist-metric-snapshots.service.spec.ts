import { ArtistMetricSnapshotsService } from './artist-metric-snapshots.service';
import { METRIC_KEYS } from './metric-keys';
import type { SocialPlatformProfileSnapshot } from './social-platform-sync.types';

/**
 * Fake repo with an in-memory store that reproduces the real behavior the
 * logic depends on: UNIQUE (tenant_id, artist_id, platform, metric,
 * observed_at) with ON CONFLICT DO NOTHING (orIgnore), and reads filtered
 * by tenant/artist/platform/metric/from/to. Not a shallow mock — dedup and
 * tenant isolation need to be real for the idempotency and security
 * assertions to make sense.
 */
function buildFakeRepo() {
  const store: any[] = [];
  let idSeq = 0;

  const keyOf = (r: { tenant_id: string; artist_id: string; platform: string; metric: string; observed_at: Date }) =>
    `${r.tenant_id}|${r.artist_id}|${r.platform}|${r.metric}|${r.observed_at.toISOString()}`;

  const predicateFor = (params: Record<string, unknown>) => {
    const [key] = Object.keys(params);
    const val = params[key];
    switch (key) {
      case 'tenantId':
        return (r: any) => r.tenant_id === val;
      case 'artistId':
        return (r: any) => r.artist_id === val;
      case 'platform':
        return (r: any) => r.platform === val;
      case 'metric':
        return (r: any) => r.metric === val;
      case 'from':
        return (r: any) => r.observed_at.getTime() >= (val as Date).getTime();
      case 'to':
        return (r: any) => r.observed_at.getTime() <= (val as Date).getTime();
      default:
        return () => true;
    }
  };

  const repo = {
    createQueryBuilder: () => {
      let insertRows: any[] = [];
      const predicates: Array<(r: any) => boolean> = [];
      const qb: any = {
        insert: () => qb,
        into: () => qb,
        values: (rows: any[]) => {
          insertRows = rows;
          return qb;
        },
        orIgnore: () => qb,
        execute: async () => {
          const identifiers = insertRows.map((row) => {
            const k = keyOf(row);
            if (store.some((s) => keyOf(s) === k)) return {};
            idSeq += 1;
            store.push({ ...row, id: `id-${idSeq}` });
            return { id: `id-${idSeq}` };
          });
          return { identifiers };
        },
        where: (_expr: string, params: Record<string, unknown>) => {
          predicates.push(predicateFor(params));
          return qb;
        },
        andWhere: (_expr: string, params: Record<string, unknown>) => {
          predicates.push(predicateFor(params));
          return qb;
        },
        orderBy: () => qb,
        getMany: async () =>
          store
            .filter((r) => predicates.every((p) => p(r)))
            .sort((a, b) => a.observed_at.getTime() - b.observed_at.getTime()),
      };
      return qb;
    },
    __store: store,
  };
  return repo;
}

function buildService(repo: ReturnType<typeof buildFakeRepo>) {
  return new ArtistMetricSnapshotsService({ getRepository: () => repo } as never);
}

function baseSnapshot(overrides: Partial<SocialPlatformProfileSnapshot> & { raw_payload?: Record<string, unknown> }): SocialPlatformProfileSnapshot {
  return {
    tenant_id: 't1',
    artist_id: 'a1',
    platform: 'spotify',
    external_id: 'ext',
    external_url: 'https://open.spotify.com/artist/ext',
    display_name: null,
    username: 'handle',
    profile_url: 'https://open.spotify.com/artist/ext',
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
  } as SocialPlatformProfileSnapshot;
}

describe('ArtistMetricSnapshotsService', () => {
  it('1. first snapshot: writes a real historical point', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    const snapshot = baseSnapshot({
      monthly_listeners: 1000,
      raw_payload: { observed_at: '2026-08-01T00:00:00.000Z', soundcharts_uuid: 'uuid-1' },
    });

    const result = await service.recordFromProfileSnapshot(snapshot);

    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(repo.__store).toHaveLength(1);
    expect(repo.__store[0].metric).toBe(METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS);
    expect(repo.__store[0].value).toBe(1000);
  });

  it('2. second snapshot (different date): accumulates, does not replace the first', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 1000, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );
    const result = await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 1100, raw_payload: { observed_at: '2026-08-02T00:00:00.000Z' } }),
    );

    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(repo.__store).toHaveLength(2);
    expect(repo.__store.map((r) => r.value)).toEqual([1000, 1100]);
  });

  it('3. duplicate observed_at between two distinct syncs: the second one is discarded (logical uniqueness)', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 1000, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );
    const result = await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 1000, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );

    expect(result).toEqual({ inserted: 0, skipped: 1 });
    expect(repo.__store).toHaveLength(1);
  });

  it('4. same value at different timestamps: both are written (key is observed_at, not value)', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 500, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );
    const result = await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 500, raw_payload: { observed_at: '2026-08-02T00:00:00.000Z' } }),
    );

    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(repo.__store).toHaveLength(2);
    expect(repo.__store.every((r) => r.value === 500)).toBe(true);
  });

  it('5. real zero: value 0 is written as a legitimate point, not discarded', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    const result = await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 0, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );

    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(repo.__store).toHaveLength(1);
    expect(repo.__store[0].value).toBe(0);
  });

  it('6. null/unavailable metric: no point is fabricated', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    const result = await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: null, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );

    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(repo.__store).toHaveLength(0);
  });

  it('7. provider error (sync_status=failed): nothing is written to history', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    const result = await service.recordFromProfileSnapshot(
      baseSnapshot({
        sync_status: 'failed',
        last_error: 'Spotify API respondeu 429',
        monthly_listeners: null,
        raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' },
      }),
    );

    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(repo.__store).toHaveLength(0);
  });

  it('8. profile not found (PROFILE_NOT_FOUND): nothing is written to history', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    const result = await service.recordFromProfileSnapshot(
      baseSnapshot({
        sync_status: 'failed',
        last_error: 'PROFILE_NOT_FOUND',
        monthly_listeners: null,
        raw_payload: { identity_status: 'PROFILE_NOT_FOUND', observed_at: '2026-08-01T00:00:00.000Z' },
      }),
    );

    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(repo.__store).toHaveLength(0);
  });

  it('9. two artists: isolation — one\'s history never shows up in the other\'s', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ artist_id: 'artist-a', monthly_listeners: 100, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );
    await service.recordFromProfileSnapshot(
      baseSnapshot({ artist_id: 'artist-b', monthly_listeners: 200, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );

    const historyA = await service.history({ tenantId: 't1', artistId: 'artist-a', platform: 'spotify', metric: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS });
    expect(historyA).toEqual([{ value: 100, observedAt: new Date('2026-08-01T00:00:00.000Z') }]);
  });

  it('10. two tenants: isolation — tenant A never sees tenant B\'s snapshots', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ tenant_id: 'tenant-a', monthly_listeners: 100, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );
    await service.recordFromProfileSnapshot(
      baseSnapshot({ tenant_id: 'tenant-b', monthly_listeners: 999, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );

    const historyTenantA = await service.history({ tenantId: 'tenant-a', artistId: 'a1', platform: 'spotify', metric: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS });
    expect(historyTenantA).toEqual([{ value: 100, observedAt: new Date('2026-08-01T00:00:00.000Z') }]);
  });

  it('11. two platforms: written independently for the same artist', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ platform: 'spotify', monthly_listeners: 100, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );
    await service.recordFromProfileSnapshot(
      baseSnapshot({ platform: 'deezer', followers: 200, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );

    expect(repo.__store).toHaveLength(2);
    const platforms = repo.__store.map((r) => r.platform).sort();
    expect(platforms).toEqual(['deezer', 'spotify']);
  });

  it('12. two metrics from the same sync (YouTube subscribers vs views): independent series', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({
        platform: 'youtube',
        subscribers: 5000,
        total_views: '1000000',
        total_videos: 42,
        raw_payload: {
          subscribers_provenance: {
            metric_series: [
              { value: 4000, observed_at: '2026-07-01T00:00:00.000Z' },
              { value: 5000, observed_at: '2026-08-01T00:00:00.000Z' },
            ],
          },
          views_videos_provenance: { fetched_at: '2026-08-01T00:00:00.000Z' },
        },
      }),
    );

    const subs = await service.history({ tenantId: 't1', artistId: 'a1', platform: 'youtube', metric: METRIC_KEYS.YOUTUBE_SUBSCRIBERS });
    const views = await service.history({ tenantId: 't1', artistId: 'a1', platform: 'youtube', metric: METRIC_KEYS.YOUTUBE_VIEWS });

    expect(subs).toHaveLength(2);
    expect(views).toEqual([{ value: 1_000_000, observedAt: new Date('2026-08-01T00:00:00.000Z') }]);
  });

  it('13. registered link swap between two syncs: both points preserved with their own provenance', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ username: 'handle-antigo', monthly_listeners: 100, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );
    await service.recordFromProfileSnapshot(
      baseSnapshot({ username: 'handle-novo', monthly_listeners: 150, raw_payload: { observed_at: '2026-08-02T00:00:00.000Z' } }),
    );

    expect(repo.__store).toHaveLength(2);
    expect(repo.__store.map((r) => r.registered_identifier)).toEqual(['handle-antigo', 'handle-novo']);
  });

  it('14. resolved Soundcharts entity swap between two syncs: no silent merge — each point keeps its own provider_entity_id', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 100, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z', soundcharts_uuid: 'uuid-antigo' } }),
    );
    await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 150, raw_payload: { observed_at: '2026-08-02T00:00:00.000Z', soundcharts_uuid: 'uuid-novo' } }),
    );

    expect(repo.__store.map((r) => r.provider_entity_id)).toEqual(['uuid-antigo', 'uuid-novo']);
  });

  it('15. idempotent retry: resending the same snapshot does not duplicate any point', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    const snapshot = baseSnapshot({ monthly_listeners: 100, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } });

    const first = await service.recordFromProfileSnapshot(snapshot);
    const retry = await service.recordFromProfileSnapshot(snapshot);

    expect(first).toEqual({ inserted: 1, skipped: 0 });
    expect(retry).toEqual({ inserted: 0, skipped: 1 });
    expect(repo.__store).toHaveLength(1);
  });

  it('dev_mock never enters history, even with sync_status=success', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    const result = await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 100, raw_payload: { source: 'dev_mock', observed_at: '2026-08-01T00:00:00.000Z' } }),
    );

    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(repo.__store).toHaveLength(0);
  });

  it('growth() uses computeGrowth over the real history filtered by tenant/artist/platform/metric', async () => {
    const repo = buildFakeRepo();
    const service = buildService(repo);
    await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 1000, raw_payload: { observed_at: '2026-07-01T00:00:00.000Z' } }),
    );
    await service.recordFromProfileSnapshot(
      baseSnapshot({ monthly_listeners: 1100, raw_payload: { observed_at: '2026-08-01T00:00:00.000Z' } }),
    );

    const result = await service.growth({
      tenantId: 't1',
      artistId: 'a1',
      platform: 'spotify',
      metric: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS,
      periodDays: 30,
      asOf: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(result.status).toBe('OK');
  });
});
