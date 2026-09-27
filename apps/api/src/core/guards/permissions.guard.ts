import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_DISABLED } from '../auth-disabled';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RbacDecisionService } from '../rbac/rbac-decision.service';
import {
  getPersistedAuthorityMode,
  isPermissionEnforcementEnabled,
  type PersistedAuthorityMode,
} from '../rbac/rbac-authority-mode';
import { IS_PUBLIC_KEY } from './auth.guard';
import { AUTH_BOOTSTRAP_KEY } from '../decorators/auth-bootstrap.decorator';
import { redactUrl } from '../security/redact';
import { permissionDeniedException } from './authorization-errors';

export {
  getPersistedAuthorityMode,
  isPermissionEnforcementEnabled,
  type PersistedAuthorityMode,
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);
  constructor(
    private readonly reflector: Reflector,
    private readonly decisions: RbacDecisionService,
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

    const required = this.collectRequiredPermissions(context);
    if (required.length === 0) return true;

    const mode = getPersistedAuthorityMode();
    if (mode === 'OFF') return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (!request.currentMember && mode === 'ON') {
      this.logger.error('RBAC context missing: the member must be resolved before the permission check.');
      throw permissionDeniedException();
    }
    const active = request.rbacActiveDecision ?? {
      decision: 'ALLOW' as const,
      source: 'legacy_role_hierarchy' as const,
      reason: 'roles_guard_state_missing',
      requiredRoles: [],
      startedAt: Date.now(),
    };
    let shadowDecision: 'ALLOW' | 'DENY';
    try {
      shadowDecision = await this.decisions.evaluate({
        request,
        requiredPermissions: required,
        active,
      });
    } catch {
      shadowDecision = 'DENY';
    }

    if (mode === 'ON' && shadowDecision === 'DENY') {
      const route =
        `${request.method ?? ''} ${redactUrl(request.originalUrl ?? request.url ?? '')}`.trim();
      this.logger.warn(`Permission denied on ${route}; required: ${required.join(', ')}`);
      throw permissionDeniedException();
    }
    return true;
  }

  private collectRequiredPermissions(
    context: ExecutionContext,
  ): string[] {
    const handler =
      this.reflector.get<string[]>(
        PERMISSIONS_KEY,
        context.getHandler(),
      ) ?? [];
    const klass =
      this.reflector.get<string[]>(
        PERMISSIONS_KEY,
        context.getClass(),
      ) ?? [];
    return Array.from(new Set([...klass, ...handler]));
  }
}
