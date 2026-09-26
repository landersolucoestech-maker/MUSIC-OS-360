import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';

/**
 * MembershipRoleResolverService (STEP 12-G — dual-write role → role_id).
 *
 * Resolves the legacy `org_members.role` string to the canonical `role_id`, respecting:
 *  - tenant scope (the tenant's own role OR a global one);
 *  - alias (`canonical_role_id`) → resolves to the canonical one;
 *  - rejection of an archived / removed / cross-tenant / unmatched role.
 *
 * RULE 12-G: a fallback to 'viewer' is FORBIDDEN. No match → error (classification).
 * Does NOT change authorization nor `org_members.role`; only derives `role_id`.
 */
export type RoleResolutionClass =
  | 'OK'
  | 'ALIAS'
  | 'SEM_CORRESPONDENCIA'
  | 'CROSS_TENANT'
  | 'ARQUIVADA'
  | 'REMOVIDA'
  | 'ALIAS_INVALIDO';

export interface RoleResolution {
  roleId: string | null;
  classification: RoleResolutionClass;
  detail: string;
}

@Injectable()
export class MembershipRoleResolverService {
  private readonly logger = new Logger('MembershipRoleResolver');

  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource | null) {}

  /** Non-throwing variant: classifies the resolution (used by the dry-run and the logs). */
  async classify(tenantId: string, roleSlug: string): Promise<RoleResolution> {
    if (!this.ds) throw new ServiceUnavailableException('DB indisponível para resolução de role');

    const rows = (await this.ds.query(
      `SELECT "id", "tenant_id", "canonical_role_id", "archived_at", "deleted_at"
         FROM "roles"
        WHERE "slug" = $1 AND ("tenant_id" = $2 OR "tenant_id" IS NULL)
        ORDER BY ("tenant_id" = $2) DESC NULLS LAST
        LIMIT 1`,
      [roleSlug, tenantId],
    )) as Array<{ id: string; tenant_id: string | null; canonical_role_id: string | null; archived_at: Date | null; deleted_at: Date | null }>;

    if (rows.length === 0) {
      const other = (await this.ds.query(
        `SELECT 1 FROM "roles" WHERE "slug" = $1 AND "tenant_id" IS NOT NULL AND "tenant_id" <> $2 AND "deleted_at" IS NULL LIMIT 1`,
        [roleSlug, tenantId],
      )) as unknown[];
      if (other.length > 0) {
        return { roleId: null, classification: 'CROSS_TENANT', detail: `role '${roleSlug}' existe apenas em outro tenant` };
      }
      return { roleId: null, classification: 'SEM_CORRESPONDENCIA', detail: `role '${roleSlug}' sem role canônica` };
    }

    const r = rows[0];
    if (r.deleted_at) return { roleId: null, classification: 'REMOVIDA', detail: `role '${roleSlug}' soft-deletada` };
    if (r.archived_at) return { roleId: null, classification: 'ARQUIVADA', detail: `role '${roleSlug}' arquivada` };

    if (r.canonical_role_id) {
      const can = (await this.ds.query(
        `SELECT "id", "archived_at", "deleted_at" FROM "roles" WHERE "id" = $1 LIMIT 1`,
        [r.canonical_role_id],
      )) as Array<{ id: string; archived_at: Date | null; deleted_at: Date | null }>;
      if (can.length === 0 || can[0].deleted_at || can[0].archived_at) {
        return { roleId: null, classification: 'ALIAS_INVALIDO', detail: `alias '${roleSlug}' aponta para role inválida` };
      }
      return { roleId: can[0].id, classification: 'ALIAS', detail: `alias '${roleSlug}' → canônico` };
    }

    return { roleId: r.id, classification: 'OK', detail: `role '${roleSlug}'` };
  }

  /** Throwing variant (used by the dual-write writers). No viewer fallback. */
  async resolveOrThrow(tenantId: string, roleSlug: string, ctx: { membershipId?: string } = {}): Promise<string> {
    const res = await this.classify(tenantId, roleSlug);
    if (res.roleId) {
      this.logger.log(
        `role.resolved membership=${ctx.membershipId ?? '-'} tenant=${tenantId} role='${roleSlug}' role_id=${res.roleId} class=${res.classification}`,
      );
      return res.roleId;
    }
    this.logger.warn(
      `role.invalid membership=${ctx.membershipId ?? '-'} tenant=${tenantId} role='${roleSlug}' class=${res.classification} (${res.detail})`,
    );
    throw new BadRequestException('Papel inválido para este membro. Contate o administrador do workspace.');
  }
}
