/**
 * core/security/rate-limit.service.ts
 *
 * RateLimitService — in-memory sliding window rate limiting.
 * Categories: auth (5/15m), api (120/1m), ai (20/1h), upload (30/1h), webhook (100/1m).
 *
 * For production with Redis: replace the internal Map with ioredis + a Lua script.
 */

import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';

export type RateLimitCategory = 'auth' | 'api' | 'ai' | 'upload' | 'webhook';

interface WindowConfig {
  maxRequests: number;
  windowMs: number;
}

const WINDOW_CONFIGS: Record<RateLimitCategory, WindowConfig> = {
  auth:    { maxRequests: 5,   windowMs: 15 * 60 * 1000 },
  api:     { maxRequests: 120, windowMs:       60 * 1000 },
  ai:      { maxRequests: 20,  windowMs: 60 * 60 * 1000 },
  upload:  { maxRequests: 30,  windowMs: 60 * 60 * 1000 },
  webhook: { maxRequests: 100, windowMs:       60 * 1000 },
};

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly windows = new Map<string, number[]>();

  async check(category: RateLimitCategory, identifier: string): Promise<void> {
    const config = WINDOW_CONFIGS[category];
    if (!config) return;

    const key  = `${category}:${identifier}`;
    const now  = Date.now();
    const hits = (this.windows.get(key) ?? []).filter((t) => now - t < config.windowMs);

    if (hits.length >= config.maxRequests) {
      const oldest     = hits[0]!;
      const retryAfter = Math.ceil((oldest + config.windowMs - now) / 1000);
      this.logger.warn(`Rate limit reached: ${key} (${hits.length}/${config.maxRequests})`);
      throw new HttpException(
        {
          message:    'Muitas requisições. Tente novamente em breve.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    hits.push(now);
    this.windows.set(key, hits);
  }
}
