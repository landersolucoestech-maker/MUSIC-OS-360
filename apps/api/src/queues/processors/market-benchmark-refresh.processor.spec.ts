import { MarketBenchmarkRefreshProcessor } from './market-benchmark-refresh.processor';
import type { MarketBenchmarkService } from '../../modules/artists/platform-profiles/analytics/market-benchmark.service';
import { ANALYTICS_REFRESH_JOB_NAMES } from '../queue.constants';
import type { MarketBenchmarkRefreshJobPayload } from '../../modules/artists/platform-profiles/analytics/market-benchmark-refresh.types';

/** DatabaseContextService mock following the artist-platform-sync.spec.ts pattern. */
const makeDbContext = () => ({
  runInTenantContext: jest.fn((_ctx: unknown, work: (m: unknown) => unknown) => work(undefined)),
});

function fakeJob(overrides: Partial<{ name: string; data: MarketBenchmarkRefreshJobPayload; id: string; attemptsMade: number }> = {}) {
  return {
    name: ANALYTICS_REFRESH_JOB_NAMES.MARKET_BENCHMARK_REFRESH,
    id: 'job-1',
    attemptsMade: 0,
    data: {
      tenant_id: 't1', artist_id: 'a1', target_uuid: 'uuid-1', engine_version: '2.0.0',
      reason: 'cold', idempotency_key: 'benchmark-refresh__t1__a1__2.0.0',
    },
    ...overrides,
  } as never;
}

describe('MarketBenchmarkRefreshProcessor', () => {
  it('job.name diferente do esperado: ignora sem chamar computeAndPersist', async () => {
    const marketBenchmark = { computeAndPersist: jest.fn() } as unknown as MarketBenchmarkService;
    const processor = new MarketBenchmarkRefreshProcessor(marketBenchmark, makeDbContext() as never);
    await processor.process(fakeJob({ name: 'outro-job' }));
    expect(marketBenchmark.computeAndPersist).not.toHaveBeenCalled();
  });

  it('processes the refresh by calling computeAndPersist with the payload identifiers (item 39: engine unchanged)', async () => {
    const marketBenchmark = {
      computeAndPersist: jest.fn().mockResolvedValue({
        result: { status: 'OK', sampleSize: 20, fallbackLevel: 1 },
        stats: { candidatesConsidered: 20, metricRequestCount: 120, cacheHits: 0, cacheMisses: 120 },
      }),
    } as unknown as MarketBenchmarkService;
    const dbContext = makeDbContext();
    const processor = new MarketBenchmarkRefreshProcessor(marketBenchmark, dbContext as never);

    await processor.process(fakeJob());
    expect(marketBenchmark.computeAndPersist).toHaveBeenCalledWith('t1', 'a1', 'uuid-1');
  });

  it('a computeAndPersist failure (e.g. a propagated SoundchartsRateLimitError): RETHROWS so BullMQ decides retry/backoff', async () => {
    const marketBenchmark = {
      computeAndPersist: jest.fn().mockRejectedValue(new Error('rate limited')),
    } as unknown as MarketBenchmarkService;
    const processor = new MarketBenchmarkRefreshProcessor(marketBenchmark, makeDbContext() as never);

    await expect(processor.process(fakeJob())).rejects.toThrow('rate limited');
  });

  it('job without tenant_id: NEVER calls computeAndPersist (fail-closed)', async () => {
    const marketBenchmark = { computeAndPersist: jest.fn() } as unknown as MarketBenchmarkService;
    const processor = new MarketBenchmarkRefreshProcessor(marketBenchmark, makeDbContext() as never);
    await processor.process(fakeJob({ data: { tenant_id: '', artist_id: 'a1', target_uuid: 'uuid-1', engine_version: '2.0.0', reason: 'cold', idempotency_key: 'k' } }));
    expect(marketBenchmark.computeAndPersist).not.toHaveBeenCalled();
  });

  it('runs computeAndPersist inside runInTenantContext with the payload tenant (RLS regression: a worker outside the HTTP request needs the context)', async () => {
    const marketBenchmark = {
      computeAndPersist: jest.fn().mockResolvedValue({
        result: { status: 'OK', sampleSize: 20, fallbackLevel: 1 },
        stats: { candidatesConsidered: 20, metricRequestCount: 120, cacheHits: 0, cacheMisses: 120 },
      }),
    } as unknown as MarketBenchmarkService;
    const dbContext = makeDbContext();
    const processor = new MarketBenchmarkRefreshProcessor(marketBenchmark, dbContext as never);

    await processor.process(fakeJob());
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 't1', orgId: null, role: null },
      expect.any(Function),
    );
  });
});
