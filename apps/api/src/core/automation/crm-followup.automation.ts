/**
 * core/automation/crm-followup.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   lead.created → crm-followup → saves an internal SUGGESTION in leads.metadata.aiFollowup
 *
 * All common orchestration (metadata + skill_runs idempotency, auditing, envelope,
 * persistence, fail-safe) lives in `runNativeSkillAutomation`.
 *
 * Restrictions: only generates an internal suggestion — NEVER sends a message, NEVER creates
 * an activity/interaction, NEVER creates a task, does not change the lead's official status/data.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { LeadCreatedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  CRM_FOLLOWUP_SYSTEM_PROMPT,
  buildCrmFollowupPrompt,
  parseCrmFollowupResponse,
  validateCrmFollowupInput,
  type CrmFollowupInput,
  type CrmStage,
  type CrmLeadType,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'crm-followup';

const LEAD_TYPES: readonly CrmLeadType[] = [
  'artist', 'label', 'publisher', 'producer', 'brand', 'partner', 'supplier', 'client', 'other',
];

/** Maps the lead's free-form status to the skill's canonical stage. */
const STAGE_MAP: Record<string, CrmStage> = {
  novo: 'new', new: 'new',
  contatado: 'contacted', contactado: 'contacted', contacted: 'contacted',
  qualificado: 'qualified', qualified: 'qualified',
  proposta: 'proposal', proposal: 'proposal',
  negociacao: 'negotiation', 'negociação': 'negotiation', negotiation: 'negotiation',
  ganho: 'won', convertido: 'won', won: 'won',
  perdido: 'lost', lost: 'lost',
  inativo: 'inactive', inactive: 'inactive',
};

function mapStage(status: string | null | undefined, pipelineStage: string | null | undefined): CrmStage {
  const s = (status ?? pipelineStage ?? '').trim().toLowerCase();
  return STAGE_MAP[s] ?? 'new';
}

interface LeadRow {
  nome: string;
  empresa: string | null;
  status: string | null;
  fonte: string | null;
  pipeline_stage: string | null;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class CrmFollowupAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.LEAD_CREATED, { async: true })
  async onLeadCreated(event: DomainEvent<LeadCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const leadId = payload?.leadId;

    await runNativeSkillAutomation<LeadRow, CrmFollowupInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.LEAD_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: null,
        entityType: 'lead',
        entityId: leadId,
        metadataKey: 'aiFollowup',
        systemPrompt: CRM_FOLLOWUP_SYSTEM_PROMPT,
        load: (manager) => this.loadLead(tenantId, leadId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateCrmFollowupInput,
        buildPrompt: buildCrmFollowupPrompt,
        parseResponse: parseCrmFollowupResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, leadId, next, manager),
      },
    );
  }

  // ── Persistence (read/write of leads.metadata via DataSource) ────────

  private async loadLead(
    tenantId: string,
    leadId: string,
    manager: EntityManager,
  ): Promise<LeadRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT nome, empresa, status, fonte, pipeline_stage, metadata
         FROM leads
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        LIMIT 1`,
      [leadId, tenantId],
    )) as LeadRow[];
    return rows?.[0] ?? null;
  }

  private async persistMetadata(
    tenantId: string,
    leadId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE leads SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), leadId, tenantId],
    );
  }

  // ── Skill input assembly ────────────────────────────────────────────────────

  private buildInput(lead: LeadRow): CrmFollowupInput {
    const md = (lead.metadata ?? {}) as Record<string, unknown>;

    const mdType = typeof md.leadType === 'string' ? md.leadType.toLowerCase() : '';
    const leadType: CrmLeadType = (LEAD_TYPES as readonly string[]).includes(mdType)
      ? (mdType as CrmLeadType)
      : 'other';

    const input: CrmFollowupInput = {
      leadName: lead.nome,
      leadType,
      currentStage: mapStage(lead.status, lead.pipeline_stage),
      objective: `Avançar o lead "${lead.nome}" no funil e definir o próximo passo comercial.`,
      language: 'pt-BR',
    };

    const contextParts: string[] = [];
    if (lead.empresa) contextParts.push(`Empresa: ${lead.empresa}.`);
    if (lead.fonte) contextParts.push(`Origem/fonte: ${lead.fonte}.`);
    if (typeof md.context === 'string') contextParts.push(md.context);
    if (contextParts.length > 0) input.context = contextParts.join(' ');

    return input;
  }
}
