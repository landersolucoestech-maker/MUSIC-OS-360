/**
 * cache/cache.module.ts
 *
 * In-memory cache module (Map with TTL).
 * Replaces Upstash Redis — no external dependencies.
 * Suitable for development and environments without a dedicated Redis.
 *
 * For production with Redis: replace the provider with the ioredis client
 * using REDIS_CACHE_URL.
 */

import { Module, Global, Logger } from '@nestjs/common';

export const CACHE_CLIENT = Symbol('CACHE_CLIENT');

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, exSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
}

class InMemoryCacheClient implements CacheClient {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: exSeconds ? Date.now() + exSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next    = (current ? parseInt(current, 10) : 0) + 1;
    const entry   = this.store.get(key);
    await this.set(key, String(next), entry?.expiresAt ? Math.ceil((entry.expiresAt - Date.now()) / 1000) : undefined);
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: CACHE_CLIENT,
      useFactory: () => {
        const logger = new Logger('CacheModule');
        logger.log('In-memory cache enabled');
        return new InMemoryCacheClient();
      },
    },
  ],
  exports: [CACHE_CLIENT],
})
export class CacheModule {}
