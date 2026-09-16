/**
 * core/automation/campaign-report.automation.ts
 *
 * Automação NATIVA, INTERNA e INVISÍVEL:
 *   campaign.ended → campaign-report → salva SUGESTÃO em
 *   campaigns.metadata.aiCampaignReport
 *
 * Toda a orquestração comum (idempotência metadata + skill_runs, auditoria,
 * envelope, persistência, fail-safe) vive em `runNativeSkillAutomation`. Aqui
 * ficam apenas as partes específicas: load da campanha + contagem real de
 * tarefas/assets (campaign_tasks/campaign_assets), montagem do input e o
 * UPDATE da tabela `campaigns`.
 *
 * ANTI-FABRICAÇÃO (deliberado): não existe, hoje, nenhum mapeamento
 * campanha-interna → campanha-de-mídia-paga persistido no schema (a
 * integração Google Ads não referencia `campaigns.id`). Por isso
 * `externalMetrics` é deliberadamente NUNCA populado aqui — fica undefined,
 * e o parser/validador da skill (enforceNoFabricatedMetrics) força
 * hasMeasuredPerformanceData=false e availability="unavailable" nesse caso.
 * Quando um mapeamento real existir, popular externalMetrics aqui a partir
 * de dados reais é a única mudança necessária — a skill já suporta o caso
 * "actual".
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { CampaignEndedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  CAMPAIGN_REPORT_SYSTEM_PROMPT,
  buildCampaignReportPrompt,
  parseCampaignReportResponse,
  validateCampaignReportInput,
  type CampaignReportInput,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'campaign-report';

interface CampaignRow {
  nome: string | null;
  type: string | null;
  objetivo: string | null;
  status: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  metadata: Record<string, unknown> | null;
  artist_name: string | null;
  tasks_total: string | number | null;
  tasks_completed: string | number | null;
  assets_used_count: string | number | null;
}

@Injectable()
export class CampaignReportAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.CAMPAIGN_ENDED, { async: true })
  async onCampaignEnded(event: DomainEvent<CampaignEndedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const campaignId = payload?.campaignId;

    await runNativeSkillAutomation<CampaignRow, CampaignReportInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.CAMPAIGN_ENDED,
        skillName: SKILL_NAME,
        tenantId,
        userId: null,
        entityType: 'campaign',
        entityId: campaignId,
        metadataKey: 'aiCampaignReport',
        systemPrompt: CAMPAIGN_REPORT_SYSTEM_PROMPT,
        load: (manager) => this.loadCampaign(tenantId, campaignId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateCampaignReportInput,
        buildPrompt: buildCampaignReportPrompt,
        parseResponse: parseCampaignReportResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, campaignId, next, manager),
      },
    );
  }

  // ── Persistência (read/write de campaigns.metadata via DataSource) ─────────

  private async loadCampaign(
    tenantId: string,
    campaignId: string,
    manager: EntityManager,
  ): Promise<CampaignRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT c.nome, c.type, c.objetivo, c.status, c.start_date, c.end_date, c.metadata,
              a.nome_artistico AS artist_name,
              (SELECT COUNT(*) FROM campaign_tasks t WHERE t.campaign_id = c.id AND t.tenant_id = c.tenant_id) AS tasks_total,
              (SELECT COUNT(*) FROM campaign_tasks t WHERE t.campaign_id = c.id AND t.tenant_id = c.tenant_id AND t.status = 'done') AS tasks_completed,
              (SELECT COUNT(*) FROM campaign_assets ca WHERE ca.campaign_id = c.id AND ca.tenant_id = c.tenant_id AND ca.deleted_at IS NULL) AS assets_used_count
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

  // ── Montagem do input da skill ──────────────────────────────────────────────

  private buildInput(c: CampaignRow): CampaignReportInput {
    const input: CampaignReportInput = {
      campaignName: c.nome?.trim() || 'Campanha',
      campaignType: c.type?.trim() || 'geral',
      // CampaignStatus.CANCELLED é o único desfecho que não é "completed";
      // qualquer outro status neste ponto do ciclo de vida (ENDED) é conclusão.
      outcomeStatus: c.status === 'cancelled' ? 'cancelled' : 'completed',
      language: 'pt-BR',
    };

    if (c.objetivo?.trim()) input.objective = c.objetivo.trim();
    if (c.artist_name?.trim()) input.relatedArtist = c.artist_name.trim();
    if (c.start_date) input.startDate = new Date(c.start_date).toISOString();
    if (c.end_date) input.endDate = new Date(c.end_date).toISOString();

    const tasksTotal = c.tasks_total != null ? Number(c.tasks_total) : 0;
    if (tasksTotal > 0) {
      input.tasksTotal = tasksTotal;
      input.tasksCompleted = c.tasks_completed != null ? Number(c.tasks_completed) : 0;
    }

    const assetsUsedCount = c.assets_used_count != null ? Number(c.assets_used_count) : 0;
    if (assetsUsedCount > 0) input.assetsUsedCount = assetsUsedCount;

    // externalMetrics deliberadamente omitido — ver doc-comment do arquivo.

    return input;
  }
}
