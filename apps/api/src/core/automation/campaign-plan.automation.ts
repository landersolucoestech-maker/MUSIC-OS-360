/**
 * core/automation/campaign-plan.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   campaign.created → campaign-plan → saves a SUGGESTION in
 *   campaigns.metadata.aiCampaignPlan
 *
 * All common orchestration (metadata + skill_runs idempotency, auditing,
 * envelope, persistence, fail-safe) lives in `runNativeSkillAutomation`. Only
 * the specific parts live here: loading the campaign, assembling the input and the
 * UPDATE of the `campaigns` table.
 *
 * Only writes an internal SUGGESTION — does NOT change the official budget/dates/status,
 * no tasks, no notifications, no new tables.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { CampaignCreatedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  CAMPAIGN_PLAN_SYSTEM_PROMPT,
  buildCampaignPlanPrompt,
  parseCampaignPlanResponse,
  validateCampaignPlanInput,
  type CampaignPlanInput,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'campaign-plan';

interface CampaignRow {
  name: string | null;
  type: string | null;
  objetivo: string | null;
  orcamento: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  metadata: Record<string, unknown> | null;
  artist_name: string | null;
}

@Injectable()
export class CampaignPlanAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.CAMPAIGN_CREATED, { async: true })
  async onCampaignCreated(event: DomainEvent<CampaignCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const campaignId = payload?.campaignId;

    await runNativeSkillAutomation<CampaignRow, CampaignPlanInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.CAMPAIGN_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.createdBy ?? null,
        entityType: 'campaign',
        entityId: campaignId,
        metadataKey: 'aiCampaignPlan',
        systemPrompt: CAMPAIGN_PLAN_SYSTEM_PROMPT,
        load: (manager) => this.loadCampaign(tenantId, campaignId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateCampaignPlanInput,
        buildPrompt: buildCampaignPlanPrompt,
        parseResponse: parseCampaignPlanResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, campaignId, next, manager),
      },
    );
  }

  // ── Persistence (read/write of campaigns.metadata via DataSource) ──────────

  private async loadCampaign(
    tenantId: string,
    campaignId: string,
    manager: EntityManager,
  ): Promise<CampaignRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT c.name, c.type, c.objetivo, c.orcamento, c.start_date, c.end_date, c.metadata,
              a.nome_artistico AS artist_name
         FROM campaigns c
         LEFT JOIN artists a
           ON a.id = c.artist_id AND a.tenant_id = c.tenant_id AND a.deleted_at IS NULL
        WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL
        LIMIT 1`,
      [campaignId, tenantId],
    )) as CampaignRow[];
    return rows?.[0] ?? null;
  }

  private async persistMetadata(
    tenantId: string,
    campaignId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE campaigns SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), campaignId, tenantId],
    );
  }

  // ── Skill input assembly ────────────────────────────────────────────────────

  private buildInput(c: CampaignRow): CampaignPlanInput {
    const md = (c.metadata ?? {}) as Record<string, unknown>;

    const input: CampaignPlanInput = {
      campaignName: c.name?.trim() || 'Campanha',
      campaignType: c.type?.trim() || 'geral',
      language: 'pt-BR',
    };

    if (c.objetivo?.trim()) input.objective = c.objetivo.trim();
    if (c.orcamento != null) input.budget = Number(c.orcamento);
    if (typeof md.currency === 'string') input.currency = md.currency;
    if (c.start_date) input.startDate = new Date(c.start_date).toISOString();
    if (c.end_date) input.endDate = new Date(c.end_date).toISOString();
    if (c.artist_name?.trim()) input.relatedArtist = c.artist_name.trim();
    if (Array.isArray(md.platforms)) {
      const platforms = md.platforms.filter((p): p is string => typeof p === 'string');
      if (platforms.length > 0) input.platforms = platforms;
    }

    return input;
  }
}
