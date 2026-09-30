import { DisposableWorkerError, runInDisposableWorker } from './disposable-worker';

const REPLY = "const { parentPort, workerData } = require('node:worker_threads');";

async function failureOf(run: () => Promise<unknown>): Promise<DisposableWorkerError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(DisposableWorkerError);
    return error as DisposableWorkerError;
  }
  throw new Error('expected the worker to fail');
}

describe('runInDisposableWorker', () => {
  afterEach(() => {
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it('resolves with the first message the worker posts', async () => {
    const reply = await runInDisposableWorker<{ doubled: number[] }>(
      `${REPLY} parentPort.postMessage({ doubled: workerData.values.map((value) => value * 2) });`,
      { values: [1, 2, 3] },
      { timeoutMs: 5_000 },
    );
    expect(reply).toEqual({ doubled: [2, 4, 6] });
  });

  it('keeps a prototype polluted inside the worker out of this process and out of the reply', async () => {
    const reply = await runInDisposableWorker<{ seenInWorker: unknown; rows: Record<string, unknown>[] }>(
      `${REPLY}
       Object.prototype.polluted = 'yes';
       parentPort.postMessage({ seenInWorker: ({}).polluted, rows: [{ name: 'Ana' }] });`,
      null,
      { timeoutMs: 5_000 },
    );
    expect(reply.seenInWorker).toBe('yes');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(reply.rows[0]!)).toEqual(['name']);
    expect(reply.rows[0]!.polluted).toBeUndefined();
  });

  it('terminates runaway CPU at the deadline while this event loop keeps running', async () => {
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
    }, 5);
    const started = Date.now();
    try {
      const error = await failureOf(() => runInDisposableWorker('for (;;) {}', null, { timeoutMs: 300 }));
      expect(error.failure).toBe('timeout');
    } finally {
      clearInterval(interval);
    }
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(ticks).toBeGreaterThan(5);
  });

  it('reports a worker that throws or exits without replying as crashed', async () => {
    expect((await failureOf(() => runInDisposableWorker("throw new Error('boom');", null, { timeoutMs: 5_000 }))).failure).toBe(
      'crashed',
    );
    expect((await failureOf(() => runInDisposableWorker('process.exit(3);', null, { timeoutMs: 5_000 }))).failure).toBe(
      'crashed',
    );
  });

  it('starts the worker without the parent environment (no secrets)', async () => {
    process.env.DISPOSABLE_WORKER_SPEC_SECRET = 'must-not-leak';
    try {
      const keys = await runInDisposableWorker<string[]>(`${REPLY} parentPort.postMessage(Object.keys(process.env));`, null, {
        timeoutMs: 5_000,
      });
      expect(keys).toEqual([]);
    } finally {
      delete process.env.DISPOSABLE_WORKER_SPEC_SECRET;
    }
  });
});
