/**
 * core/automation/postiz.automation.ts
 *
 * Skill ON_DEMAND (ver on-demand-skill.runner.ts): avalia a prontidão de
 * publicação de um post real (`marketing_content_posts`, já gerado por
 * social-content) — NUNCA publica nada.
 *
 * Reaproveita o estado de conexão REAL já existente por canal:
 *   instagram → InstagramService.getProviderStatus (OAuth real)
 *   tiktok    → TikTokService.getOrganicStatus (OAuth real)
 *   youtube   → YouTubeService.isConfigured() (chave de API global, sem
 *               conceito de "conexão por tenant" — nunca posting, só leitura)
 *   facebook/twitter/threads → nenhum serviço de integração existe;
 *               reportado como "not_implemented" (nunca fabricado)
 *
 * Nunca chama MarketingPublishingProcessor.publish() nem qualquer endpoint
 * de escrita em provedor externo.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import { InstagramService } from '../../modules/integrations/instagram/instagram.service';
import { TikTokService } from '../../modules/integrations/tiktok/tiktok.service';
import { YouTubeService } from '../../modules/integrations/youtube/youtube.service';
import {
  POSTIZ_SYSTEM_PROMPT,
  buildPostizPrompt,
  parsePostizResponse,
  validatePostizInput,
  type PostizInput,
  type PostizOutput,
  type PostizChannelReadiness,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const SKILL_NAME = 'postiz';

interface ContentRow {
  title: string | null;
  channel: string | null;
  copy: string | null;
}

@Injectable()
export class PostizAutomation {
  constructor(
    @Inject(DATA_SOURCE) @Optional() private readonly ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    private readonly instagram: InstagramService,
    private readonly tiktok: TikTokService,
    private readonly youtube: YouTubeService,
  ) {}

  async run(
    tenantId: string,
    userId: string,
    contentId: string,
  ): Promise<OnDemandSkillResult<PostizOutput>> {
    const row = await this.loadContent(tenantId, contentId);
    if (!row) throw new NotFoundException('Conteúdo não encontrado');

    const channel = row.channel?.trim() || 'instagram';
    const channelReadiness = await this.resolveChannelReadiness(tenantId, userId, channel);

    const input: PostizInput = {
      postTitle: row.title?.trim() || 'Post',
      channel,
      channelReadiness,
      hasCopy: !!row.copy?.trim(),
      copyLength: row.copy?.trim().length ?? 0,
      language: 'pt-BR',
    };

    return runOnDemandSkill<PostizInput, PostizOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: SKILL_NAME,
        tenantId,
        userId,
        entityType: 'marketing_content_post',
        entityId: contentId,
        systemPrompt: POSTIZ_SYSTEM_PROMPT,
        input,
        buildPrompt: buildPostizPrompt,
        parseResponse: parsePostizResponse,
        validateInput: validatePostizInput,
      },
    );
  }

  private async loadContent(tenantId: string, contentId: string): Promise<ContentRow | null> {
    if (!this.ds) return null;
    const rows = (await this.ds.query(
      `SELECT title, channel, copy
         FROM marketing_content_posts
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        LIMIT 1`,
      [contentId, tenantId],
    )) as ContentRow[];
    return rows?.[0] ?? null;
  }

  private async resolveChannelReadiness(
    tenantId: string,
    userId: string,
    channel: string,
  ): Promise<PostizChannelReadiness> {
    try {
      if (channel === 'instagram') {
        const status = await this.instagram.getProviderStatus(tenantId, userId);
        return this.mapOAuthStatus(status);
      }
      if (channel === 'tiktok') {
        const status = await this.tiktok.getOrganicStatus(tenantId, userId);
        return this.mapOAuthStatus(status);
      }
      if (channel === 'youtube') {
        // Chave de API global (leitura de métricas públicas) — sem conceito de
        // conexão por tenant, e sem capacidade de postagem alguma no código.
        return 'not_implemented';
      }
      // facebook, twitter, threads: nenhum serviço de integração existe.
      return 'not_implemented';
    } catch {
      return 'provider_error';
    }
  }

  private mapOAuthStatus(status: { connected: boolean; needs_reauth?: boolean }): PostizChannelReadiness {
    if (status.needs_reauth) return 'requires_reauth';
    if (status.connected) return 'connected';
    return 'available_not_connected';
  }
}
