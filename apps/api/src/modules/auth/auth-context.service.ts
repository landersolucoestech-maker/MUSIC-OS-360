import { Inject, Injectable, Optional } from '@nestjs/common';
import { RbacService } from '../../core/rbac/rbac.service';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import { canonicalPlanFeatures } from '../../common/compat/plan-features';

interface AuthClaims {
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

@Injectable()
export class AuthContextService {
  constructor(
    private readonly rbac: RbacService,
    @Optional() @Inject(DATA_SOURCE) private readonly ds?: DataSource | null,
  ) {}

  async build(
    auth: { userId: string; orgId: string | null; orgRole: string | null; claims: Record<string, unknown> },
    tenant: Record<string, unknown> | undefined,
    member: Record<string, unknown> | undefined,
  ) {
    const claims = auth.claims as AuthClaims;
    const appMetadata = asObject(claims.app_metadata);
    const userMetadata = asObject(claims.user_metadata);
    const role = asString(member?.['role'], auth.orgRole ?? 'viewer');
    const roleId = typeof member?.['role_id'] === 'string' && (member['role_id'] as string).length > 0
      ? (member['role_id'] as string)
      : null;
    const tenantId = asString(tenant?.['id'], auth.orgId ?? '');
    const orgId = asString(tenant?.['org_id'], auth.orgId ?? tenantId);

    // DUAL-SOURCE (PHASE 5): database permissions when role_id exists; otherwise, the legacy matrix.
    const permissions = await this.rbac.getEffectivePermissions({
      role,
      role_id: roleId,
      tenant_id: tenantId.length > 0 ? tenantId : null,
    });
    if (this.ds && tenantId && auth.userId) {
      await this.ds.query(
        `UPDATE "tenant_invitations"
            SET "status" = 'accepted', "accepted_at" = COALESCE("accepted_at", now()),
                "updated_at" = now()
          WHERE "tenant_id" = $1 AND "auth_user_id" = $2 AND "status" = 'pending'`,
        [tenantId, auth.userId],
      ).catch(() => undefined);
    }

    return {
      user: {
        id: auth.userId,
        email: asString(member?.['email'], claims.email ?? ''),
        fullName: asString(member?.['full_name'], asString(userMetadata['full_name'])),
        avatarUrl: asString(userMetadata['avatar_url']) || null,
      },
      workspace: {
        id: tenantId,
        orgId,
        name: asString(tenant?.['name'], 'MUSIC OS 360'),
        slug: asString(tenant?.['slug'], 'workspace'),
        active: asBoolean(tenant?.['active'], true),
        plan: asString(tenant?.['plan'], 'starter'),
        // dual-read: tenants.features may still carry the legacy `moduleRh` key until migration 20260930000024 ran
        features: canonicalPlanFeatures(asObject(tenant?.['features'])),
        settings: asObject(tenant?.['settings']),
      },
      membership: {
        id: asString(member?.['id']),
        authUserId: auth.userId,
        role,
        isActive: asBoolean(member?.['is_active'], true),
        permissions,
        hierarchyLevel: this.rbac.getHierarchyLevel(role),
      },
      claims: {
        orgId: auth.orgId,
        role: auth.orgRole,
        appMetadata,
      },
    };
  }
}
