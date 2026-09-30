import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { redactDiagnosticText } from '../../core/filters/redact-diagnostic';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { PROVISIONING_DATA_SOURCE } from '../../database/database.tokens';
import type { ProvisionWorkspaceDto } from './dto/provision-workspace.dto';

interface ExistingMembership {
  org_id: string;
  tenant_id: string;
  role: string;
  role_id: string | null;
}

@Injectable()
export class WorkspaceProvisioningService {
  private readonly logger = new Logger(WorkspaceProvisioningService.name);

  constructor(
    @Inject(PROVISIONING_DATA_SOURCE)
    private readonly ds: DataSource | null,
    private readonly config: ConfigService,
  ) {}

  async provision(
    user: {
      userId: string;
      claims: Record<string, unknown>;
    },
    dto: ProvisionWorkspaceDto,
  ) {
    if (!this.ds?.isInitialized) {
      throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    }
    const email = typeof user.claims['email'] === 'string'
      ? user.claims['email']
      : '';
    const userMetadata = this.asObject(user.claims['user_metadata']);
    const currentAppMetadata = this.asObject(user.claims['app_metadata']);
    const fullName = typeof userMetadata['full_name'] === 'string'
      ? userMetadata['full_name']
      : null;

    const queryRunner = this.ds.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        [`workspace-provision:${user.userId}`],
      );

      const existing = (await queryRunner.query(
        `SELECT member."org_id", member."tenant_id", member."role", member."role_id"
           FROM "org_members" member
           JOIN "tenants" tenant ON tenant."id" = member."tenant_id"
          WHERE member."auth_user_id" = $1
            AND member."is_active" = true
            AND member."deleted_at" IS NULL
            AND tenant."active" = true
            AND tenant."deleted_at" IS NULL
          ORDER BY member."joined_at" DESC NULLS LAST, member."created_at" DESC
          LIMIT 1`,
        [user.userId],
      )) as ExistingMembership[];

      let membership = existing[0];
      let created = false;
      if (!membership) {
        await queryRunner.query(
          `SELECT pg_advisory_xact_lock(hashtext($1))`,
          [`workspace-slug:${dto.workspaceSlug}`],
        );
        const slugExists = await queryRunner.query(
          `SELECT 1
             FROM "organizations"
            WHERE "slug" = $1 AND "deleted_at" IS NULL
            UNION ALL
           SELECT 1
             FROM "tenants"
            WHERE "slug" = $1 AND "deleted_at" IS NULL
            LIMIT 1`,
          [dto.workspaceSlug],
        ) as unknown[];
        if (slugExists.length > 0) {
          throw new ConflictException('Este endereço de workspace já está em uso.');
        }

        const ownerRoles = await queryRunner.query(
          `SELECT "id"
             FROM "roles"
            WHERE "slug" = 'owner'
              AND "tenant_id" IS NULL
              AND "hierarchy_level" = 90
              AND "archived_at" IS NULL
              AND "deleted_at" IS NULL
            LIMIT 1`,
        ) as Array<{ id: string }>;
        const ownerRoleId = ownerRoles[0]?.id;
        if (!ownerRoleId) {
          throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
        }

        const organizations = await queryRunner.query(
          `INSERT INTO "organizations" (
             "name", "slug", "plan", "billing_status", "industry", "phone",
             "address", "config", "metadata"
           )
           VALUES ($1, $2, 'starter', 'trial', $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
           RETURNING "id"`,
          [
            dto.organizationName.trim(),
            dto.workspaceSlug,
            dto.segment ?? 'gravadora',
            dto.phone ?? null,
            JSON.stringify({
              line1: dto.address ?? null,
              city: dto.city ?? null,
              state: dto.state ?? null,
            }),
            JSON.stringify({
              tradeName: dto.tradeName ?? null,
              corporateEmail: dto.corporateEmail ?? null,
            }),
            JSON.stringify({
              signupUserId: user.userId,
              acceptedTerms: dto.acceptedTerms === true,
              acceptedLgpd: dto.acceptedLgpd === true,
            }),
          ],
        ) as Array<{ id: string }>;
        const orgId = organizations[0].id;

        const tenants = await queryRunner.query(
          `INSERT INTO "tenants" (
             "org_id", "name", "slug", "plan", "features", "settings", "active"
           )
           VALUES ($1, $2, $3, 'starter', '{}'::jsonb, $4::jsonb, true)
           RETURNING "id"`,
          [
            orgId,
            dto.workspaceName.trim(),
            dto.workspaceSlug,
            JSON.stringify({
              requestedPlan: dto.requestedPlan ?? 'trial_14',
              onboarding: { completed: false, currentStep: 'company_profile' },
            }),
          ],
        ) as Array<{ id: string }>;
        const tenantId = tenants[0].id;

        const memberships = await queryRunner.query(
          `INSERT INTO "org_members" (
             "org_id", "tenant_id", "auth_user_id", "email", "full_name",
             "role", "role_id", "is_active", "joined_at"
           )
           VALUES ($1, $2, $3, $4, $5, 'owner', $6, true, now())
           RETURNING "org_id", "tenant_id", "role", "role_id"`,
          [orgId, tenantId, user.userId, email, fullName, ownerRoleId],
        ) as ExistingMembership[];
        membership = memberships[0];
        created = true;
      }

      const supabase = createClient(
        this.config.getOrThrow<string>('SUPABASE_URL'),
        this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      );
      const { error } = await supabase.auth.admin.updateUserById(user.userId, {
        app_metadata: {
          ...currentAppMetadata,
          org_id: membership.tenant_id,
          role: membership.role,
        },
      });
      if (error) {
        this.logger.error(`Supabase updateUserById (workspace provisioning) failed: ${redactDiagnosticText(error.message)}`);
        throw new ServiceUnavailableException({
          message: 'Não foi possível atualizar a sessão. Tente novamente.',
          error: 'SESSION_UPDATE_FAILED',
        });
      }

      await queryRunner.commitTransaction();
      this.logger.log(JSON.stringify({
        event: 'workspace_provisioned',
        user_id: user.userId,
        tenant_id: membership.tenant_id,
        role: membership.role,
        created,
      }));
      return {
        created,
        orgId: membership.org_id,
        tenantId: membership.tenant_id,
        role: membership.role,
        roleId: membership.role_id,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      this.logger.error(JSON.stringify({
        event: 'workspace_provisioning_failed',
        user_id: user.userId,
        error: redactDiagnosticText(error instanceof Error ? error.message : String(error)),
      }));
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }
}
