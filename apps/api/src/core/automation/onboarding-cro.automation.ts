/**
 * core/automation/onboarding-cro.automation.ts
 *
 * ON_DEMAND skill (see on-demand-skill.runner.ts): computes a tenant's REAL
 * onboarding progress from real, already existing counts —
 * the 6 steps defined in apps/web/src/app/providers/TenantContext.tsx
 * (OnboardingStep) were never computed by any backend before this
 * automation (repo-wide grep confirmed); only `company_profile`/`complete`
 * were written via OnboardingService.complete().
 *
 * Each `completed` is a boolean DERIVED deterministically from a real SQL
 * count here — the model never decides it, it only receives the
 * already computed result. No aggregated cross-tenant conversion rate is
 * produced (there is no funnel/cohort engine in the product).
 */

import { Injectable, Inject, Optional, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  ONBOARDING_CRO_SYSTEM_PROMPT,
  buildOnboardingCroPrompt,
  parseOnboardingCroResponse,
  validateOnboardingCroInput,
  type OnboardingCroInput,
  type OnboardingCroOutput,
  type OnboardingStepName,
  type OnboardingStepStatus,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const SKILL_NAME = 'onboarding-cro';

interface TenantRow {
  name: string | null;
  onboarding_completed: boolean;
}

@Injectable()
export class OnboardingCroAutomation {
  constructor(
    @Inject(DATA_SOURCE) @Optional() private readonly ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
  ) {}

  async run(
    tenantId: string,
    userId: string,
  ): Promise<OnDemandSkillResult<OnboardingCroOutput>> {
    const tenant = await this.loadTenant(tenantId);
    if (!tenant) throw new NotFoundException('Workspace não encontrado.');

    const [artists, catalogWorks, catalogRecordings, contracts, members, oauthConnections] = await Promise.all([
      this.count('artists', tenantId),
      this.count('works', tenantId),
      this.count('phonograms', tenantId),
      this.count('contracts', tenantId),
      this.count('org_members', tenantId),
      this.count('oauth_connections', tenantId, { hasDeletedAt: false }),
    ]);

    const steps: OnboardingStepStatus[] = [
      { step: 'company_profile', completed: tenant.onboarding_completed, evidenceCount: tenant.onboarding_completed ? 1 : 0 },
      { step: 'invite_team', completed: members > 1, evidenceCount: members },
      { step: 'first_artist', completed: artists > 0, evidenceCount: artists },
      { step: 'first_catalog_item', completed: catalogWorks + catalogRecordings > 0, evidenceCount: catalogWorks + catalogRecordings },
      { step: 'first_contract', completed: contracts > 0, evidenceCount: contracts },
      { step: 'connect_integration', completed: oauthConnections > 0, evidenceCount: oauthConnections },
    ];

    const input: OnboardingCroInput = {
      tenantName: tenant.name?.trim() || 'Workspace',
      steps,
      language: 'pt-BR',
    };

    return runOnDemandSkill<OnboardingCroInput, OnboardingCroOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: SKILL_NAME,
        tenantId,
        userId,
        entityType: 'tenant',
        entityId: tenantId,
        systemPrompt: ONBOARDING_CRO_SYSTEM_PROMPT,
        input,
        buildPrompt: buildOnboardingCroPrompt,
        parseResponse: parseOnboardingCroResponse,
        validateInput: validateOnboardingCroInput,
      },
    );
  }

  private async loadTenant(tenantId: string): Promise<TenantRow | null> {
    if (!this.ds) return null;
    const rows = (await this.ds.query(
      `SELECT name, COALESCE((settings->'onboarding'->>'completed')::boolean, false) AS onboarding_completed
         FROM tenants
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1`,
      [tenantId],
    )) as TenantRow[];
    return rows?.[0] ?? null;
  }

  private async count(table: string, tenantId: string, opts: { hasDeletedAt: boolean } = { hasDeletedAt: true }): Promise<number> {
    if (!this.ds) return 0;
    const clause = opts.hasDeletedAt ? 'WHERE tenant_id = $1 AND deleted_at IS NULL' : 'WHERE tenant_id = $1';
    const rows = (await this.ds.query(
      `SELECT COUNT(*)::int AS cnt FROM "${table}" ${clause}`,
      [tenantId],
    )) as Array<{ cnt: number }>;
    return rows?.[0]?.cnt ?? 0;
  }
}

export type { OnboardingStepName };
