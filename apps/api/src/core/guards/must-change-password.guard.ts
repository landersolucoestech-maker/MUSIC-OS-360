/**
 * must-change-password.guard.ts  (Part 73)
 *
 * Supabase Auth has no native "mandatory password change" flag —
 * it is modelled in `app_metadata.must_change_password` (set when the real
 * institutional owner is created, see bootstrap-tenant-zero.cli.ts) and travels in the
 * JWT like any other claim (same mechanism as org_id/role — see
 * auth.guard.ts). This guard blocks every route, except a minimal
 * allowlist, while the flag is true — the real security gate lives in the
 * backend, not only in a frontend redirect (which a determined user
 * could bypass).
 *
 * The allowlist deliberately includes /auth/context (the frontend needs it
 * to know it must show the password change screen) and
 * /auth/change-required-password (Part 74 — the only endpoint that can
 * take the account out of this state, and it only does so atomically: it really changes the
 * password AND clears the flag in the same Admin API call), but NOT
 * /auth/onboarding — the sequence is always: change the password first, then
 * (if applicable) the company setup wizard.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTH_BOOTSTRAP_KEY } from '../decorators/auth-bootstrap.decorator';
import { AUTH_DISABLED } from '../auth-disabled';

const ALWAYS_ALLOWED_PREFIXES = [
  '/auth/logout',
  '/auth/context',
  '/auth/change-required-password',
  '/health',
];

function normalizePath(req: Request): string {
  const raw = (req.route?.path && typeof req.route.path === 'string')
    ? req.originalUrl
    : req.originalUrl ?? req.url ?? '';
  return raw.replace(/^\/api\/v\d+/, '').split('?')[0] || '/';
}

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    const appMetadata = request.auth?.claims?.['app_metadata'] as Record<string, unknown> | undefined;
    const mustChange = appMetadata?.['must_change_password'] === true;
    if (!mustChange) return true;

    const path = normalizePath(request);
    if (startsWithAny(path, ALWAYS_ALLOWED_PREFIXES)) return true;

    throw new ForbiddenException({
      error: 'MUST_CHANGE_PASSWORD',
      message: 'Troca de senha obrigatória antes de continuar.',
    });
  }
}
