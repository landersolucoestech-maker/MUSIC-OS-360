import { ConcurrencyLimitError, ConcurrencyLimiter } from './concurrency-limiter';

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('ConcurrencyLimiter', () => {
  it('runs at most maxActive tasks, queues the next ones in FIFO order and hands slots over', async () => {
    const limiter = new ConcurrencyLimiter({ maxActive: 2, maxQueued: 2, maxPerKey: 10 });
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const started: number[] = [];
    const runs = gates.map((gate, index) =>
      limiter.run(async () => {
        started.push(index);
        await gate.promise;
        return index;
      }),
    );
    await tick();
    expect(started).toEqual([0, 1]);
    expect(limiter.stats).toEqual({ active: 2, queued: 2 });

    gates[1]!.resolve();
    await tick();
    expect(started).toEqual([0, 1, 2]);
    gates[0]!.resolve();
    await tick();
    expect(started).toEqual([0, 1, 2, 3]);
    gates[2]!.resolve();
    gates[3]!.resolve();
    await expect(Promise.all(runs)).resolves.toEqual([0, 1, 2, 3]);
    expect(limiter.stats).toEqual({ active: 0, queued: 0 });
  });

  it('refuses immediately when every slot and queue place is taken', async () => {
    const limiter = new ConcurrencyLimiter({ maxActive: 1, maxQueued: 1, maxPerKey: 10 });
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    const second = limiter.run(() => gate.promise);
    await expect(limiter.run(() => gate.promise)).rejects.toEqual(new ConcurrencyLimitError('queue_full'));
    gate.resolve();
    await Promise.all([first, second]);
    await expect(limiter.run(async () => 'free again')).resolves.toBe('free again');
  });

  it('caps the tasks one key has in flight and releases the key when they end, even on failure', async () => {
    const limiter = new ConcurrencyLimiter({ maxActive: 4, maxQueued: 4, maxPerKey: 1 });
    const gate = deferred();
    const tenantA = limiter.run(() => gate.promise, 'tenant-a');
    await expect(limiter.run(async () => 'x', 'tenant-a')).rejects.toEqual(new ConcurrencyLimitError('key_limit'));
    await expect(limiter.run(async () => 'other tenant', 'tenant-b')).resolves.toBe('other tenant');
    gate.reject(new Error('parse failed'));
    await expect(tenantA).rejects.toThrow('parse failed');
    await expect(limiter.run(async () => 'released', 'tenant-a')).resolves.toBe('released');
    expect(limiter.stats).toEqual({ active: 0, queued: 0 });
  });
});
