import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SystemRole } from '@music-os-360/types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AUTH_DISABLED } from '../auth-disabled';
import { RbacDecisionService } from '../rbac/rbac-decision.service';
import { IS_PUBLIC_KEY } from './auth.guard';
import { ROLE_HIERARCHY, roleLevel } from '../rbac/role-hierarchy';
import { AUTH_BOOTSTRAP_KEY } from '../decorators/auth-bootstrap.decorator';
import { redactUrl } from '../security/redact';
import { permissionDeniedException } from './authorization-errors';
export { ROLE_HIERARCHY } from '../rbac/role-hierarchy';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function minAcceptedLevel(roles: string[] | undefined): number | null {
  if (!roles || roles.length === 0) return null;
  return Math.min(...roles.map((role) => roleLevel(role) ?? 99));
}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
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

    const classRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getClass(),
    );
    const handlerRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    const requiredRoles = Array.from(
      new Set([...(classRoles ?? []), ...(handlerRoles ?? [])]),
    );
    const requiredPermissions = Array.from(
      new Set([
        ...(this.reflector.get<string[]>(
          PERMISSIONS_KEY,
          context.getClass(),
        ) ?? []),
        ...(this.reflector.get<string[]>(
          PERMISSIONS_KEY,
          context.getHandler(),
        ) ?? []),
      ]),
    );
    const request = context.switchToHttp().getRequest<Request>();
    const startedAt = Date.now();
    const classLevel = minAcceptedLevel(classRoles);
    const handlerLevel = minAcceptedLevel(handlerRoles);

    if (classLevel === null && handlerLevel === null) {
      if (WRITE_METHODS.has((request.method ?? '').toUpperCase())) {
        await this.recordBeforeDeny(
          request,
          requiredPermissions,
          requiredRoles,
          'mutable_route_without_roles',
          startedAt,
        );
        this.logger.error(
          `RBAC: route ${request.method} ${redactUrl(request.url ?? '')} declares no @Roles - blocked by the fail-closed policy.`,
        );
        throw permissionDeniedException();
      }
      request.rbacActiveDecision = {
        decision: 'ALLOW',
        source: 'legacy_role_hierarchy',
        reason: 'no_role_requirement',
        requiredRoles,
        startedAt,
      };
      return true;
    }

    const requiredLevel = Math.max(classLevel ?? 0, handlerLevel ?? 0);
    const requiredLabels = [classRoles, handlerRoles]
      .filter(
        (roles): roles is string[] =>
          Array.isArray(roles) && roles.length > 0,
      )
      .map((roles) => roles.join(' ou '))
      .join(' + ');
    const member = request.currentMember;

    if (!member) {
      await this.recordBeforeDeny(
        request,
        requiredPermissions,
        requiredRoles,
        'missing_membership_context',
        startedAt,
      );
      this.logger.error('RBAC context missing: TenantGuard must resolve the member before authorization.');
      throw permissionDeniedException();
    }

    const memberRole =
      ((member as Record<string, unknown>)['role'] as string | undefined) ??
      SystemRole.VIEWER;
    const memberLevel = roleLevel(memberRole) ?? 0;

    if (memberLevel < requiredLevel) {
      await this.recordBeforeDeny(
        request,
        requiredPermissions,
        requiredRoles,
        'insufficient_role_hierarchy',
        startedAt,
      );
      this.logger.warn(`Insufficient role: current=${memberRole}, required=${requiredLabels}`);
      throw permissionDeniedException();
    }

    request.rbacActiveDecision = {
      decision: 'ALLOW',
      source: 'legacy_role_hierarchy',
      reason: null,
      requiredRoles,
      startedAt,
    };
    return true;
  }

  private async recordBeforeDeny(
    request: Request,
    requiredPermissions: string[],
    requiredRoles: string[],
    reason: string,
    startedAt: number,
  ): Promise<void> {
    const active = {
      decision: 'DENY' as const,
      source: 'legacy_role_hierarchy' as const,
      reason,
      requiredRoles,
      startedAt,
    };
    request.rbacActiveDecision = active;
    if (requiredPermissions.length > 0) {
      await this.decisions.evaluate({
        request,
        requiredPermissions,
        active,
      });
    }
  }
}
