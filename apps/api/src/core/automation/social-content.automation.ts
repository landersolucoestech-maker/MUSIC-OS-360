/**
 * core/automation/social-content.automation.ts
 *
 * Automação NATIVA, INTERNA e INVISÍVEL:
 *   marketing.content_created → social-content → salva SUGESTÃO em
 *   marketing_content_posts.metadata.aiSocialContent
 *
 * Toda a orquestração comum (idempotência metadata + skill_runs, auditoria,
 * envelope, persistência, fail-safe) vive em `runNativeSkillAutomation`. Aqui
 * ficam apenas as partes específicas: load do post (+ nome da campanha
 * relacionada, quando houver), montagem do input e o UPDATE da tabela
 * `marketing_content_posts`.
 *
 * ANTI-FABRICAÇÃO / generated != published (deliberado): esta automação
 * NUNCA escreve em `copy`, `status` ou `publication_status` — apenas grava
 * uma sugestão de variações de legenda/hashtags em metadata. A publicação
 * real (fila `marketing-publishing`, `MarketingPublishingProcessor.publish()`)
 * é um boundary totalmente separado e hoje reporta honestamente "não
 * configurada" para qualquer canal — esta skill nunca implica o contrário.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { MarketingContentCreatedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  SOCIAL_CONTENT_SYSTEM_PROMPT,
  buildSocialContentPrompt,
  parseSocialContentResponse,
  validateSocialContentInput,
  type SocialContentInput,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'social-content';

interface ContentRow {
  title: string | null;
  target_type: string | null;
  target_name: string | null;
  channel: string | null;
  content_type: string | null;
  copy: string | null;
  metadata: Record<string, unknown> | null;
  campaign_name: string | null;
}

@Injectable()
export class SocialContentAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.MARKETING_CONTENT_CREATED, { async: true })
  async onContentCreated(event: DomainEvent<MarketingContentCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const contentId = payload?.contentId;

    await runNativeSkillAutomation<ContentRow, SocialContentInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.MARKETING_CONTENT_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.createdBy ?? null,
        entityType: 'marketing_content_post',
        entityId: contentId,
        metadataKey: 'aiSocialContent',
        systemPrompt: SOCIAL_CONTENT_SYSTEM_PROMPT,
        load: (manager) => this.loadContent(tenantId, contentId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateSocialContentInput,
        buildPrompt: buildSocialContentPrompt,
        parseResponse: parseSocialContentResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, contentId, next, manager),
      },
    );
  }

  // ── Persistência (read/write de marketing_content_posts.metadata) ──────────

  private async loadContent(
    tenantId: string,
    contentId: string,
    manager: EntityManager,
  ): Promise<ContentRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT p.title, p.target_type, p.target_name, p.channel, p.content_type, p.copy, p.metadata,
              c.nome AS campaign_name
         FROM marketing_content_posts p
         LEFT JOIN campaigns c
           ON c.id = p.campaign_id AND c.tenant_id = p.tenant_id AND c.deleted_at IS NULL
        WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL
        LIMIT 1`,
      [contentId, tenantId],
    )) as ContentRow[];
    return rows?.[0] ?? null;
  }

  private async persistMetadata(
    tenantId: string,
    contentId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE marketing_content_posts SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), contentId, tenantId],
    );
  }

  // ── Montagem do input da skill ──────────────────────────────────────────────

  private buildInput(p: ContentRow): SocialContentInput {
    const input: SocialContentInput = {
      title: p.title?.trim() || 'Post',
      targetType: p.target_type?.trim() || 'geral',
      targetName: p.target_name?.trim() || '—',
      channel: p.channel?.trim() || 'instagram',
      contentType: p.content_type?.trim() || 'feed',
      language: 'pt-BR',
    };

    if (p.copy?.trim()) input.draftCopy = p.copy.trim();
    if (p.campaign_name?.trim()) input.relatedCampaign = p.campaign_name.trim();

    return input;
  }
}
