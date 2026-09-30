/**
 * core/security/concurrency-limiter.ts
 *
 * Bounds an expensive operation: at most `maxActive` tasks run at once, at most
 * `maxQueued` more wait in FIFO order, and one key (a tenant) may have at most
 * `maxPerKey` tasks in flight. Anything beyond that is refused immediately
 * (ConcurrencyLimitError), so a burst gets a fast "busy" answer instead of
 * exhausting the process's CPU and memory.
 */
export type ConcurrencyLimitReason = 'queue_full' | 'key_limit';

export class ConcurrencyLimitError extends Error {
  constructor(readonly reason: ConcurrencyLimitReason) {
    super(`concurrency limit reached (${reason})`);
    this.name = 'ConcurrencyLimitError';
  }
}

export interface ConcurrencyLimits {
  maxActive: number;
  maxQueued: number;
  maxPerKey: number;
}

export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private readonly inFlightByKey = new Map<string, number>();

  constructor(private readonly limits: ConcurrencyLimits) {}

  get stats(): { active: number; queued: number } {
    return { active: this.active, queued: this.queue.length };
  }

  async run<T>(task: () => Promise<T>, key?: string): Promise<T> {
    if (key !== undefined && (this.inFlightByKey.get(key) ?? 0) >= this.limits.maxPerKey) {
      throw new ConcurrencyLimitError('key_limit');
    }
    if (this.active >= this.limits.maxActive && this.queue.length >= this.limits.maxQueued) {
      throw new ConcurrencyLimitError('queue_full');
    }
    if (key !== undefined) this.inFlightByKey.set(key, (this.inFlightByKey.get(key) ?? 0) + 1);
    try {
      if (this.active < this.limits.maxActive) this.active += 1;
      else await new Promise<void>((resolve) => this.queue.push(resolve)); // the finishing task hands over its slot
      try {
        return await task();
      } finally {
        const next = this.queue.shift();
        if (next) next();
        else this.active -= 1;
      }
    } finally {
      if (key !== undefined) {
        const left = (this.inFlightByKey.get(key) ?? 1) - 1;
        if (left > 0) this.inFlightByKey.set(key, left);
        else this.inFlightByKey.delete(key);
      }
    }
  }
}
