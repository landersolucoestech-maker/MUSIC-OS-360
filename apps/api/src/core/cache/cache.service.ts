import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * CacheService — in-memory cache with TTL.
 * In production: replace it with the Redis implementation via @nestjs/cache-manager.
 */
@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, value: T, ttlMs = 300_000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.value;
  }

  has(key: string): boolean { return this.get(key) !== null; }

  delete(key: string): void { this.store.delete(key); }

  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void { this.store.clear(); }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs = 300_000): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /** Cache key helpers */
  static tenantKey(tenantId: string, resource: string, id?: string): string {
    return id ? `tenant:${tenantId}:${resource}:${id}` : `tenant:${tenantId}:${resource}`;
  }
}
