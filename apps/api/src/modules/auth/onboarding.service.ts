import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import type { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  async complete(
    tenantId: string,
    orgId: string,
    userId: string,
    dto: CompleteOnboardingDto,
  ) {
    return this.ds.transaction(async (manager) => {
      const organizationRows = await manager.query(
        `UPDATE "organizations"
            SET "name" = $3,
                "industry" = $4,
                "config" = COALESCE("config", '{}'::jsonb)
                  || jsonb_strip_nulls(jsonb_build_object('logoUrl', $5::text)),
                "metadata" = COALESCE("metadata", '{}'::jsonb)
                  || jsonb_build_object(
                    'onboarding_completed_at', now(),
                    'onboarding_completed_by', $6::text
                  ),
                "updated_at" = now()
          WHERE "id" = $1
            AND "deleted_at" IS NULL
            AND EXISTS (
              SELECT 1 FROM "tenants"
               WHERE "id" = $2 AND "org_id" = $1 AND "deleted_at" IS NULL
            )
          RETURNING "id", "name", "industry", "config"`,
        [orgId, tenantId, dto.companyName.trim(), dto.segment, dto.logoUrl ?? null, userId],
      ) as Array<Record<string, unknown>>;
      if (!organizationRows[0]) {
        throw new NotFoundException('Organização ou workspace não encontrado.');
      }

      const tenantRows = await manager.query(
        `UPDATE "tenants"
            SET "name" = $2,
                "settings" = COALESCE("settings", '{}'::jsonb)
                  || COALESCE($3::jsonb, '{}'::jsonb)
                  || jsonb_build_object(
                    'logoUrl', $4::text,
                    'onboarding', jsonb_build_object(
                      'completed', true,
                      'currentStep', 'complete',
                      'completedAt', now(),
                      'completedBy', $5::text
                    )
                  ),
                "updated_at" = now()
          WHERE "id" = $1
            AND "org_id" = $6
            AND "deleted_at" IS NULL
          RETURNING "id", "org_id", "name", "slug", "plan", "features",
                    "settings", "active"`,
        [
          tenantId,
          dto.companyName.trim(),
          JSON.stringify(dto.settings ?? {}),
          dto.logoUrl ?? null,
          userId,
          orgId,
        ],
      ) as Array<Record<string, unknown>>;
      if (!tenantRows[0]) throw new NotFoundException('Workspace não encontrado.');

      return {
        organization: organizationRows[0],
        workspace: tenantRows[0],
        onboarding: { completed: true, currentStep: 'complete' },
      };
    });
  }
}
