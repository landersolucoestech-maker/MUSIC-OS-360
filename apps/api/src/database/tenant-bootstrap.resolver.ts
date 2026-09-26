import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ADMIN_DATA_SOURCE } from './database.tokens';

export interface BootstrapTenant {
  id: string;
  org_id: string;
  external_auth_org_id: string | null;
  name: string;
  slug: string;
  plan: string;
  features: Record<string, unknown>;
  settings: Record<string, unknown>;
  active: boolean;
}

export interface BootstrapMember {
  id: string;
  org_id: string;
  tenant_id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  role_id: string | null;
  department_id: string | null;
  position_id: string | null;
  is_active: boolean;
}

/**
 * Resolves request identity before tenant RLS context exists.
 *
 * This component is deliberately read-only and limited to the two identity
 * lookups required by TenantGuard. Business repositories must use DATA_SOURCE.
 */
@Injectable()
export class TenantBootstrapResolver {
  constructor(
    @Inject(ADMIN_DATA_SOURCE)
    private readonly bootstrapDataSource: DataSource | null,
  ) {}

  async resolveTenant(orgId: string): Promise<BootstrapTenant | null> {
    const rows = await this.requireDataSource().query(
      `SELECT id, org_id, external_auth_org_id, name, slug, plan,
              features, settings, active
         FROM tenants
        WHERE (id::text = $1 OR org_id::text = $1 OR external_auth_org_id = $1)
          AND deleted_at IS NULL
        LIMIT 1`,
      [orgId],
    );
    return (rows[0] as BootstrapTenant | undefined) ?? null;
  }

  async resolveMembership(
    tenantId: string,
    userId: string,
  ): Promise<BootstrapMember | null> {
    const rows = await this.requireDataSource().query(
      `SELECT id, org_id, tenant_id, auth_user_id, email, full_name, role,
              role_id, department_id, position_id, is_active
         FROM org_members
        WHERE tenant_id = $1
          AND auth_user_id = $2
          AND is_active = true
          AND deleted_at IS NULL
        LIMIT 1`,
      [tenantId, userId],
    );
    return (rows[0] as BootstrapMember | undefined) ?? null;
  }

  private requireDataSource(): DataSource {
    if (!this.bootstrapDataSource?.isInitialized) {
      throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    }
    return this.bootstrapDataSource;
  }
}
