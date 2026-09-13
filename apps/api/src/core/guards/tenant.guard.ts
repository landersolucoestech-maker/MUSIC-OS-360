import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantBootstrapResolver } from '../../database/tenant-bootstrap.resolver';
import { IS_PUBLIC_KEY } from './auth.guard';
import type { Request } from 'express';
import type { JwtAuth } from './auth.guard';
import { AUTH_DISABLED, DEV_MEMBER, DEV_TENANT } from '../auth-disabled';
import { RbacDistributedCacheService } from '../rbac/rbac-distributed-cache.service';
import type {
  BootstrapMember,
  BootstrapTenant,
} from '../../database/tenant-bootstrap.resolver';
import { AUTH_BOOTSTRAP_KEY } from '../decorators/auth-bootstrap.decorator';

function readTenantHeader(request: Request): string | null {
  const raw = request.headers['x-tenant-id'];
  if (Array.isArray(raw)) return raw[0] ?? null;
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return null;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly bootstrapResolver: TenantBootstrapResolver,
    private readonly reflector: Reflector,
    @Optional()
    private readonly distributedCache?: RbacDistributedCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (AUTH_DISABLED) {
      const request = context.switchToHttp().getRequest<Request & { auth?: JwtAuth }>();
      request.auth = request.auth ?? {
        userId: String(DEV_MEMBER.auth_user_id),
        sessionId: 'dev-auth-disabled-session',
        orgId: String(DEV_TENANT.org_id),
        orgRole: String(DEV_MEMBER.role),
        claims: {},
      };
      request.tenant = DEV_TENANT;
      request.currentMember = DEV_MEMBER;
      return true;
    }

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

    const request = context.switchToHttp().getRequest<Request & { auth?: JwtAuth }>();
    const auth = request.auth;

    if (!auth?.orgId) {
      throw new UnauthorizedException('Organization not identified in token');
    }

    const tenantHeader = readTenantHeader(request);

    if (!tenantHeader) {
      throw new ForbiddenException('X-Tenant-ID header is required for protected tenant routes');
    }

    const tenantKey = `tenant:${auth.orgId}`;
    const tenant =
      (await this.distributedCache?.get<BootstrapTenant>(tenantKey)) ??
      (await this.bootstrapResolver.resolveTenant(auth.orgId));

    // `tenant.active` is a lifecycle signal only (workspace provisioned/deprovisioned),
    // not a billing/subscription-status check — same distinction documented in
    // AutentiqueService/DocuSignService's assertTenantActive (P0-A Public Boundary
    // Policy Matrix) and ExternalDataExchangeService's assertTenantActive. Billing
    // enforcement (suspended/read_only/payment_grace) is a separate concern handled
    // by BillingEnforcementGuard, never conflated with this lifecycle gate.
    if (!tenant || !tenant.active) {
      throw new UnauthorizedException('Tenant not found or inactive');
    }
    await this.distributedCache?.set(tenantKey, tenant, [], 60);

    const tenantOrgId = String((tenant as unknown as Record<string, unknown>)['org_id'] ?? '');
    const tenantExternalOrgId = String((tenant as unknown as Record<string, unknown>)['external_auth_org_id'] ?? '');
    const tenantId = String((tenant as unknown as Record<string, unknown>)['id'] ?? '');

    if (
      tenantHeader !== tenantId &&
      tenantHeader !== tenantOrgId &&
      tenantHeader !== tenantExternalOrgId &&
      tenantHeader !== auth.orgId
    ) {
      throw new ForbiddenException('Tenant header does not match resolved tenant');
    }

    const membershipKey = `membership:${tenant.id}:${auth.userId}`;
    const member =
      (await this.distributedCache?.get<BootstrapMember>(membershipKey)) ??
      (await this.bootstrapResolver.resolveMembership(tenant.id, auth.userId));

    if (!member) {
      throw new ForbiddenException('User is not an active member of this tenant');
    }
    await this.distributedCache?.set(
      membershipKey,
      member,
      member.role_id ? [member.role_id] : [],
      60,
    );

    request.tenant = tenant as unknown as Record<string, unknown>;
    request.currentMember = member as unknown as Record<string, unknown>;

    return true;
  }
}
