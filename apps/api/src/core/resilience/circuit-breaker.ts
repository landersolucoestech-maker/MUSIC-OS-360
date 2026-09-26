/**
 * core/resilience/circuit-breaker.ts
 *
 * Lightweight circuit breaker for external HTTP integrations.
 *
 * States:
 *   CLOSED    — normal operation; failures are counted
 *   OPEN      — requests fail immediately (ServiceUnavailableException)
 *   HALF_OPEN — one probe request allowed; success → CLOSED, failure → OPEN
 *
 * Configuration (per instance, with sensible defaults):
 *   failureThreshold  — consecutive failures to trip the breaker (default 5)
 *   resetTimeoutMs    — ms to wait in OPEN before trying HALF_OPEN (default 30s)
 *   successThreshold  — successes in HALF_OPEN to close (default 1)
 */

import { ServiceUnavailableException, Logger } from '@nestjs/common';

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name:              string;
  failureThreshold?: number;
  resetTimeoutMs?:   number;
  successThreshold?: number;
}

export class CircuitBreaker {
  private readonly logger = new Logger('CircuitBreaker');
  private state:           State  = 'CLOSED';
  private failureCount:    number = 0;
  private successCount:    number = 0;
  private openedAt:        number = 0;

  private readonly name:             string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs:   number;
  private readonly successThreshold: number;

  constructor(opts: CircuitBreakerOptions) {
    this.name             = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs   = opts.resetTimeoutMs   ?? 30_000;
    this.successThreshold = opts.successThreshold ?? 1;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.transitionIfNeeded();

    if (this.state === 'OPEN') {
      throw new ServiceUnavailableException('Integração temporariamente indisponível. Tente novamente em instantes.');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err as Error);
      throw err;
    }
  }

  get isOpen(): boolean { return this.state === 'OPEN'; }

  getState(): State { return this.state; }

  private transitionIfNeeded(): void {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.resetTimeoutMs) {
      this.logger.log(`[${this.name}] OPEN → HALF_OPEN (probe allowed)`);
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.logger.log(`[${this.name}] HALF_OPEN → CLOSED`);
        this.state        = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(err: Error): void {
    this.failureCount++;
    if (this.state === 'HALF_OPEN') {
      this.logger.warn(`[${this.name}] HALF_OPEN probe failed — reopening: ${err.message}`);
      this.trip();
    } else if (this.failureCount >= this.failureThreshold) {
      this.logger.error(`[${this.name}] CLOSED → OPEN after ${this.failureCount} failures`);
      this.trip();
    }
  }

  private trip(): void {
    this.state    = 'OPEN';
    this.openedAt = Date.now();
  }
}
