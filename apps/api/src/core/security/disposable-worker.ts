/**
 * core/security/disposable-worker.ts
 *
 * Runs a CommonJS script once in a fresh worker thread and resolves with the
 * first message it posts. Used to keep a library that parses untrusted input
 * away from the API process:
 *  - the worker has its own V8 heap and built-ins, so a prototype it pollutes
 *    never reaches this thread and dies with the worker;
 *  - only structured-cloneable data comes back (own properties, no prototypes,
 *    no functions);
 *  - it gets a hard deadline, so runaway CPU (a catastrophic regex) is
 *    terminated while this thread's event loop keeps serving requests;
 *  - it starts with an empty `process.env` (no secrets) and heap limits.
 * The worker is always terminated: on its reply, on its error or at the deadline.
 */
import { Worker, type ResourceLimits } from 'node:worker_threads';

export type DisposableWorkerFailure = 'timeout' | 'crashed';

export class DisposableWorkerError extends Error {
  constructor(
    readonly failure: DisposableWorkerFailure,
    detail: string,
  ) {
    super(detail);
    this.name = 'DisposableWorkerError';
  }
}

export interface DisposableWorkerOptions {
  timeoutMs: number;
  resourceLimits?: ResourceLimits;
}

export function runInDisposableWorker<T>(
  source: string,
  workerData: unknown,
  options: DisposableWorkerOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(source, {
      eval: true,
      workerData,
      env: {},
      resourceLimits: options.resourceLimits,
    });
    let settled = false;
    const deadline = setTimeout(
      () => finish(() => reject(new DisposableWorkerError('timeout', `worker exceeded ${options.timeoutMs} ms`))),
      options.timeoutMs,
    );
    function finish(settle: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      settle();
      void worker.terminate();
    }
    worker.once('message', (message: T) => finish(() => resolve(message)));
    worker.once('error', (error: Error) => finish(() => reject(new DisposableWorkerError('crashed', error.message))));
    worker.once('exit', (code: number) =>
      finish(() => reject(new DisposableWorkerError('crashed', `worker exited with code ${code} before replying`))),
    );
  });
}
