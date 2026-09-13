import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTH_BOOTSTRAP_KEY } from '../decorators/auth-bootstrap.decorator';
import { AUTH_DISABLED } from '../auth-disabled';
import { BillingEnforcementService } from '../../modules/billing/billing-enforcement.service';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const ALWAYS_ALLOWED_PREFIXES = [
  '/auth/logout',
  '/billing',
  '/support',
  '/support-tickets',
  '/health',
  '/metrics',
];

function normalizePath(req: Request): string {
  const raw = (req.route?.path && typeof req.route.path === 'string')
    ? req.originalUrl
    : req.originalUrl ?? req.url ?? '';
  // Express routing is case-insensitive by default, so the allowlist/denylist
  // comparison below must be too — otherwise a differently-cased request path
  // (e.g. /Billing/...) would bypass prefix matching against ALWAYS_ALLOWED_PREFIXES.
  return raw.toLowerCase().replace(/^\/api\/v\d+/i, '').split('?')[0] || '/';
}

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

@Injectable()
export class BillingEnforcementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billing: BillingEnforcementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (AUTH_DISABLED) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isAuthBootstrap = this.reflector.getAllAndOverride<boolean>(
      AUTH_BOOTSTRAP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isAuthBootstrap) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = (request.tenant as Record<string, unknown> | undefined)?.['id'];
    if (typeof tenantId !== 'string' || tenantId.length === 0) return true;

    const path = normalizePath(request);
    if (startsWithAny(path, ALWAYS_ALLOWED_PREFIXES)) return true;

    // find-d45d822d: this must be the escalating read — the guard is the
    // live per-request enforcement point that has to observe and settle any
    // due payment_grace -> read_only -> suspended transition, not the pure
    // `getState()` used by diagnostic/admin reads.
    const state = await this.billing.getStateWithEscalation(tenantId);
    if (!state) return true;

    // P0-A-R2: blanket-deny-except-allowlist, not an enumerated denylist.
    // The prior SUSPENDED_BLOCKED_PREFIXES list covered ~27 of 87 controller
    // groups (confirmed regression, not intentional tightening — the
    // frontend's own shipped contract, docs/backend-v2/15-frontend-auth-
    // permission-contracts.md + App.tsx's BillingGuard, already implements
    // blanket-deny-except-this-same-allowlist). Any path already past the
    // ALWAYS_ALLOWED_PREFIXES check above is blocked for a suspended tenant,
    // including routes added after this guard was written — the previous
    // enumerated list could never cover those by construction.
    if (state.status === 'suspended') {
      throw new ForbiddenException({
        error: 'TENANT_SUSPENDED',
        message: 'Subscription payment overdue',
      });
    }

    if (state.status === 'read_only' && !READ_METHODS.has((request.method ?? '').toUpperCase())) {
      throw new ForbiddenException({
        error: 'TENANT_READ_ONLY',
        message: 'Subscription payment overdue. Workspace is temporarily read-only.',
      });
    }

    return true;
  }
}
