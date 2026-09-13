/**
 * core/guards/rate-limit.guard.ts
 *
 * Global rate limiting guard.
 * Runs before JwtAuthGuard/TenantGuard, therefore it must not rely on tenant context.
 */

import { Optional, Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitService } from '../security/rate-limit.service';
import type { RateLimitCategory } from '../security/rate-limit.service';

function firstForwardedIp(value: unknown): string | null {
  if (Array.isArray(value)) return firstForwardedIp(value[0]);
  if (typeof value !== 'string') return null;
  const first = value.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

/**
 * find-fd6b5b2b: CF-Connecting-IP/X-Real-IP/X-Forwarded-For are all fully
 * client-settable and were trusted unconditionally, with no validation that
 * a trusted proxy actually set them — this app's confirmed deployment model
 * is dual (Docker long-running + Vercel serverless, docs/backend-v2/61),
 * with no single verified fronting-proxy topology. Trusting these headers
 * unconditionally let an attacker mint a fresh rate-limit bucket on every
 * request just by rotating the header value, defeating brute-force
 * protection on auth routes entirely.
 *
 * Default (safe): identify the client by the raw socket peer address, which
 * the client cannot spoof via headers. Set RATE_LIMIT_TRUST_PROXY=true only
 * once an operator has confirmed the real deployment's proxy chain actually
 * sets these headers and cannot be reached directly by an untrusted client.
 */
function clientIp(request: Request): string {
  if (process.env['RATE_LIMIT_TRUST_PROXY'] === 'true') {
    return (
      firstForwardedIp(request.headers['cf-connecting-ip']) ??
      firstForwardedIp(request.headers['x-real-ip']) ??
      firstForwardedIp(request.headers['x-forwarded-for']) ??
      request.ip ??
      request.socket?.remoteAddress ??
      'unknown-ip'
    );
  }
  return request.socket?.remoteAddress ?? request.ip ?? 'unknown-ip';
}

function normalizePath(path: string): string {
  return path.toLowerCase();
}

function resolveRateLimitCategory(request: Request): RateLimitCategory {
  const path = normalizePath(request.path ?? request.originalUrl ?? '');
  if (path.includes('/auth/') || path.includes('/dev-auth')) return 'auth';
  if (path.includes('/ai/') || path.endsWith('/ai')) return 'ai';
  if (path.includes('/uploads') || path.includes('/upload')) return 'upload';
  if (path.includes('/webhook') || path.includes('/webhooks')) return 'webhook';
  return 'api';
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Optional() private readonly rateLimitService?: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.rateLimitService) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const category = resolveRateLimitCategory(request);
    const routeKey = `${request.method}:${request.route?.path ?? request.path ?? 'unknown-route'}`;
    const identifier = `${clientIp(request)}:${routeKey}`;
    await this.rateLimitService.check(category, identifier);
    return true;
  }
}
