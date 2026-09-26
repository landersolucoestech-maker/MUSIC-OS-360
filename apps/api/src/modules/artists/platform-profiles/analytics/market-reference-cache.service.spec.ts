import { MarketReferenceCacheService } from './market-reference-cache.service';
import type { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';
import { SoundchartsNotFoundError, SoundchartsRateLimitError, SoundchartsApiError } from '../../../integrations/soundcharts/soundcharts.errors';
import { MAX_CANDIDATES_PER_REFRESH } from './market-benchmark.config';

interface FakeRow {
  candidate_uuid: string;
  metric: string;
  value: string | null;
  candidate_name: string | null;
  candidate_country_code: string | null;
  updated_at: Date;
}

function buildFakeRepo(rows: FakeRow[]) {
  const inserted: unknown[] = [];
  const qb = {
    where: () => qb,
    getMany: async () => rows,
    insert: () => qb,
    into: () => qb,
    values: (v: unknown) => { inserted.push(v); return qb; },
    orUpdate: () => qb,
    execute: async () => ({}),
  };
  const repo = { createQueryBuilder: () => qb };
  return { repo, inserted };
}

function relatedItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({ uuid: `cand-${i}`, name: `Candidate ${i}` }));
}

function metric(value: number) {
  return { value, observedAt: new Date(), source: 'soundcharts' as const, endpoint: '/x', field: 'y' };
}

describe('MarketReferenceCacheService.ensureFreshCohort', () => {
  it('discovers candidates via /related and fetches live metrics when the cache is empty (cold cache)', async () => {
    const { repo, inserted } = buildFakeRepo([]);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: relatedItems(2), total: 2 }),
      getArtistCountryCode: jest.fn().mockResolvedValue('BR'),
      getSpotifyMonthlyListeners: jest.fn().mockResolvedValue(metric(1000)),
      getYouTubeAudience: jest.fn().mockResolvedValue({ subscribers: metric(2000), videos: null, views: null }),
      getDeezerFans: jest.fn().mockResolvedValue(metric(300)),
      getSoundCloudFollowers: jest.fn().mockResolvedValue(metric(400)),
      getInstagramFollowers: jest.fn().mockResolvedValue(metric(500)),
      getTikTokFollowers: jest.fn().mockResolvedValue(metric(600)),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    const { candidates, metrics, stats } = await service.ensureFreshCohort('target-uuid');

    expect(soundcharts.getRelatedArtists).toHaveBeenCalledWith('target-uuid', 0, 100);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({ uuid: 'cand-0', name: 'Candidate 0', countryCode: 'BR' });
    // 2 candidates × 6 metrics = 12 points fetched/written.
    expect(metrics).toHaveLength(12);
    expect(inserted.length).toBe(12);
    expect(stats).toEqual({ candidatesConsidered: 2, metricRequestCount: 12, cacheHits: 0, cacheMisses: 12 });
  });

  it('fresh cache (within TTL): reuses the cached value, NEVER calls Soundcharts again for that metric', async () => {
    const fresh = new Date(); // now — well within the 24h TTL
    const cachedRows: FakeRow[] = [
      { candidate_uuid: 'cand-0', metric: 'spotify.monthly_listeners', value: '9999', candidate_name: 'Candidate 0', candidate_country_code: 'BR', updated_at: fresh },
      { candidate_uuid: 'cand-0', metric: 'youtube.subscribers', value: '8888', candidate_name: 'Candidate 0', candidate_country_code: 'BR', updated_at: fresh },
      { candidate_uuid: 'cand-0', metric: 'deezer.fans', value: '7', candidate_name: 'Candidate 0', candidate_country_code: 'BR', updated_at: fresh },
      { candidate_uuid: 'cand-0', metric: 'soundcloud.followers', value: '7', candidate_name: 'Candidate 0', candidate_country_code: 'BR', updated_at: fresh },
      { candidate_uuid: 'cand-0', metric: 'instagram.followers', value: '7', candidate_name: 'Candidate 0', candidate_country_code: 'BR', updated_at: fresh },
      { candidate_uuid: 'cand-0', metric: 'tiktok.followers', value: '7', candidate_name: 'Candidate 0', candidate_country_code: 'BR', updated_at: fresh },
    ];
    const { repo } = buildFakeRepo(cachedRows);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: relatedItems(1), total: 1 }),
      getArtistCountryCode: jest.fn(),
      getSpotifyMonthlyListeners: jest.fn(),
      getYouTubeAudience: jest.fn(),
      getDeezerFans: jest.fn(),
      getSoundCloudFollowers: jest.fn(),
      getInstagramFollowers: jest.fn(),
      getTikTokFollowers: jest.fn(),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    const { metrics } = await service.ensureFreshCohort('target-uuid');

    expect(soundcharts.getSpotifyMonthlyListeners).not.toHaveBeenCalled();
    expect(soundcharts.getArtistCountryCode).not.toHaveBeenCalled(); // country also fresh, does not redo
    const spotify = metrics.find((m) => m.metricKey === 'spotify.monthly_listeners');
    expect(spotify?.value).toBe(9999); // cached value, not a new value
  });

  it('stale cache (outside the TTL): fetches again and overwrites', async () => {
    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago > 24h TTL
    const cachedRows: FakeRow[] = [
      { candidate_uuid: 'cand-0', metric: 'spotify.monthly_listeners', value: '1', candidate_name: 'Candidate 0', candidate_country_code: 'BR', updated_at: stale },
    ];
    const { repo, inserted } = buildFakeRepo(cachedRows);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: relatedItems(1), total: 1 }),
      getArtistCountryCode: jest.fn().mockResolvedValue('BR'),
      getSpotifyMonthlyListeners: jest.fn().mockResolvedValue(metric(9999)),
      getYouTubeAudience: jest.fn().mockResolvedValue({ subscribers: metric(1), videos: null, views: null }),
      getDeezerFans: jest.fn().mockResolvedValue(metric(1)),
      getSoundCloudFollowers: jest.fn().mockResolvedValue(metric(1)),
      getInstagramFollowers: jest.fn().mockResolvedValue(metric(1)),
      getTikTokFollowers: jest.fn().mockResolvedValue(metric(1)),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    const { metrics } = await service.ensureFreshCohort('target-uuid');

    expect(soundcharts.getSpotifyMonthlyListeners).toHaveBeenCalledWith('cand-0');
    const spotify = metrics.find((m) => m.metricKey === 'spotify.monthly_listeners');
    expect(spotify?.value).toBe(9999);
    expect(inserted.length).toBeGreaterThan(0);
  });

  it('candidate without an indexed platform (SoundchartsNotFoundError): metric becomes null, does not bring down the other candidates', async () => {
    const { repo } = buildFakeRepo([]);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: relatedItems(1), total: 1 }),
      getArtistCountryCode: jest.fn().mockResolvedValue(null),
      getSpotifyMonthlyListeners: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('não encontrado', 404)),
      getYouTubeAudience: jest.fn().mockResolvedValue({ subscribers: metric(1), videos: null, views: null }),
      getDeezerFans: jest.fn().mockResolvedValue(metric(1)),
      getSoundCloudFollowers: jest.fn().mockResolvedValue(metric(1)),
      getInstagramFollowers: jest.fn().mockResolvedValue(metric(1)),
      getTikTokFollowers: jest.fn().mockResolvedValue(metric(1)),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    const { metrics } = await service.ensureFreshCohort('target-uuid');
    const spotify = metrics.find((m) => m.metricKey === 'spotify.monthly_listeners');
    expect(spotify?.value).toBeNull();
    const youtube = metrics.find((m) => m.metricKey === 'youtube.subscribers');
    expect(youtube?.value).toBe(1);
  });

  // Phase 3.2, item 9: 429/5xx NEVER become a silent empty cohort — they must
  // propagate so the refresh job fails and BullMQ's retry/backoff (already
  // configured globally) takes over, instead of masking it as "no data".
  it('Soundcharts 429 (rate limit): the error PROPAGATES (does not become a null metric/empty cohort)', async () => {
    const { repo } = buildFakeRepo([]);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: relatedItems(1), total: 1 }),
      getArtistCountryCode: jest.fn().mockResolvedValue(null),
      getSpotifyMonthlyListeners: jest.fn().mockRejectedValue(new SoundchartsRateLimitError('rate limited', 429)),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    await expect(service.ensureFreshCohort('target-uuid')).rejects.toBeInstanceOf(SoundchartsRateLimitError);
  });

  it('Soundcharts 5xx (generic API error): the error PROPAGATES', async () => {
    const { repo } = buildFakeRepo([]);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: relatedItems(1), total: 1 }),
      getArtistCountryCode: jest.fn().mockResolvedValue(null),
      getSpotifyMonthlyListeners: jest.fn().mockRejectedValue(new SoundchartsApiError('internal error', 500)),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    await expect(service.ensureFreshCohort('target-uuid')).rejects.toBeInstanceOf(SoundchartsApiError);
  });

  it('timeout/generic network error: also PROPAGATES', async () => {
    const { repo } = buildFakeRepo([]);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: relatedItems(1), total: 1 }),
      getArtistCountryCode: jest.fn().mockResolvedValue(null),
      getSpotifyMonthlyListeners: jest.fn().mockRejectedValue(new Error('Timeout after 10000ms')),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    await expect(service.ensureFreshCohort('target-uuid')).rejects.toThrow('Timeout after 10000ms');
  });

  it(`respects the MAX_CANDIDATES_PER_REFRESH budget (${MAX_CANDIDATES_PER_REFRESH}) even when /related returns more`, async () => {
    const { repo } = buildFakeRepo([]);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: relatedItems(100), total: 100 }),
      getArtistCountryCode: jest.fn().mockResolvedValue(null),
      getSpotifyMonthlyListeners: jest.fn().mockResolvedValue(metric(1)),
      getYouTubeAudience: jest.fn().mockResolvedValue({ subscribers: metric(1), videos: null, views: null }),
      getDeezerFans: jest.fn().mockResolvedValue(metric(1)),
      getSoundCloudFollowers: jest.fn().mockResolvedValue(metric(1)),
      getInstagramFollowers: jest.fn().mockResolvedValue(metric(1)),
      getTikTokFollowers: jest.fn().mockResolvedValue(metric(1)),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    const { candidates } = await service.ensureFreshCohort('target-uuid');
    expect(candidates).toHaveLength(MAX_CANDIDATES_PER_REFRESH);
  });

  it('/related with no candidates (artist with no related artists): returns empty lists, with no metric call at all', async () => {
    const { repo } = buildFakeRepo([]);
    const soundcharts = {
      getRelatedArtists: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getSpotifyMonthlyListeners: jest.fn(),
    } as unknown as SoundchartsService;
    const service = new MarketReferenceCacheService({ getRepository: () => repo } as never, soundcharts);

    const result = await service.ensureFreshCohort('target-uuid');
    expect(result).toEqual({ candidates: [], metrics: [], stats: { candidatesConsidered: 0, metricRequestCount: 0, cacheHits: 0, cacheMisses: 0 } });
    expect(soundcharts.getSpotifyMonthlyListeners).not.toHaveBeenCalled();
  });
});
