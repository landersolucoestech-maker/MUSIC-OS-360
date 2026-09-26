import { MarketBenchmarkRefreshQueueService } from './market-benchmark-refresh-queue.service';

function fakeJob(state: string) {
  return { getState: jest.fn().mockResolvedValue(state), remove: jest.fn().mockResolvedValue(undefined) };
}

describe('MarketBenchmarkRefreshQueueService', () => {
  it('queue unavailable (Redis off / BullMQ no-op): returns unavailable, never throws', async () => {
    const service = new MarketBenchmarkRefreshQueueService(null);
    const outcome = await service.enqueueRefresh('t1', 'a1', 'uuid-1', '2.0.0', 'cold');
    expect(outcome).toBe('unavailable');
  });

  it('getRefreshState with the queue unavailable: not_found', async () => {
    const service = new MarketBenchmarkRefreshQueueService(null);
    expect(await service.getRefreshState('t1', 'a1', '2.0.0')).toBe('not_found');
  });

  it('enqueues normally when there is no previous job with the same jobId', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-1' });
    const getJob = jest.fn().mockResolvedValue(null);
    const queue = { add, getJob } as never;
    const service = new MarketBenchmarkRefreshQueueService(queue);

    const outcome = await service.enqueueRefresh('t1', 'a1', 'uuid-1', '2.0.0', 'cold');
    expect(outcome).toBe('enqueued');
    expect(add).toHaveBeenCalledWith(
      'market-benchmark-refresh',
      expect.objectContaining({ tenant_id: 't1', artist_id: 'a1', target_uuid: 'uuid-1', engine_version: '2.0.0', reason: 'cold' }),
      expect.objectContaining({ jobId: 'benchmark-refresh__t1__a1__2.0.0', attempts: 3 }),
    );
  });

  // Regressão: BullMQ (Job.validateOptions) lança "Custom Id cannot contain :"
  // — descoberto na validação real do worker (Fase 3.2), não pelo mock.
  it('jobId never contains ":" — regression of "Custom Id cannot contain :"', () => {
    const service = new MarketBenchmarkRefreshQueueService(null);
    expect(service.dedupKey('t1', 'a1', '2.0.0')).not.toContain(':');
  });

  // Item 7/8: dedup — job já waiting/active/delayed NUNCA gera um segundo job equivalente.
  it.each(['waiting', 'active', 'delayed'])('DEDUP: job existente em estado "%s" — suprime o novo enqueue (already_running)', async (state) => {
    const add = jest.fn();
    const getJob = jest.fn().mockResolvedValue(fakeJob(state));
    const queue = { add, getJob } as never;
    const service = new MarketBenchmarkRefreshQueueService(queue);

    const outcome = await service.enqueueRefresh('t1', 'a1', 'uuid-1', '2.0.0', 'stale');
    expect(outcome).toBe('already_running');
    expect(add).not.toHaveBeenCalled();
  });

  it('the previous job FAILED: removes the old job and tries a fresh clean run', async () => {
    const oldJob = fakeJob('failed');
    const add = jest.fn().mockResolvedValue({ id: 'job-2' });
    const getJob = jest.fn().mockResolvedValue(oldJob);
    const queue = { add, getJob } as never;
    const service = new MarketBenchmarkRefreshQueueService(queue);

    const outcome = await service.enqueueRefresh('t1', 'a1', 'uuid-1', '2.0.0', 'stale');
    expect(oldJob.remove).toHaveBeenCalled();
    expect(add).toHaveBeenCalled();
    expect(outcome).toBe('enqueued');
  });

  it('add() throws (unexpected BullMQ error): returns error, never propagates the exception', async () => {
    const add = jest.fn().mockRejectedValue(new Error('redis down mid-add'));
    const getJob = jest.fn().mockResolvedValue(null);
    const queue = { add, getJob } as never;
    const service = new MarketBenchmarkRefreshQueueService(queue);

    const outcome = await service.enqueueRefresh('t1', 'a1', 'uuid-1', '2.0.0', 'cold');
    expect(outcome).toBe('error');
  });

  it('jobId is deterministic per (tenant, artist, engineVersion) — the same combination always yields the same key', () => {
    const service = new MarketBenchmarkRefreshQueueService(null);
    const a = service.dedupKey('t1', 'a1', '2.0.0');
    const b = service.dedupKey('t1', 'a1', '2.0.0');
    const c = service.dedupKey('t1', 'a2', '2.0.0');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('getRefreshState reflects the real job state when it exists', async () => {
    const getJob = jest.fn().mockResolvedValue(fakeJob('active'));
    const queue = { getJob } as never;
    const service = new MarketBenchmarkRefreshQueueService(queue);
    expect(await service.getRefreshState('t1', 'a1', '2.0.0')).toBe('active');
  });
});
