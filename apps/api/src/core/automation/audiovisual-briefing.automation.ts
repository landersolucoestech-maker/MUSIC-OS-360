/**
 * core/automation/audiovisual-briefing.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   release.approved → audiovisual-briefing → saves an internal BRIEFING in
 *   releases.metadata.aiAudiovisualBriefing
 *
 * All common orchestration lives in `runNativeSkillAutomation`.
 *
 * Restrictions: internal briefing only — does NOT create tasks for the designer/videomaker,
 * does NOT create requests, does not change the release's official status/data.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { ReleaseApprovedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  AUDIOVISUAL_BRIEFING_SYSTEM_PROMPT,
  buildAudiovisualBriefingPrompt,
  parseAudiovisualBriefingResponse,
  validateAudiovisualBriefingInput,
  type AudiovisualBriefingInput,
  type AudiovisualContentType,
  type AudiovisualBudgetLevel,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'audiovisual-briefing';
const CONTENT_TYPES: readonly AudiovisualContentType[] = [
  'music-video', 'lyric-video', 'visualizer', 'teaser', 'reels', 'shorts', 'stories', 'institutional', 'other',
];
const BUDGET_LEVELS: readonly AudiovisualBudgetLevel[] = ['low', 'medium', 'high', 'premium'];

interface ReleaseRow {
  title: string;
  artist_name: string | null;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class AudiovisualBriefingAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.RELEASE_APPROVED, { async: true })
  async onReleaseApproved(event: DomainEvent<ReleaseApprovedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const releaseId = payload?.releaseId;

    await runNativeSkillAutomation<ReleaseRow, AudiovisualBriefingInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.RELEASE_APPROVED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.approvedBy ?? null,
        entityType: 'release',
        entityId: releaseId,
        metadataKey: 'aiAudiovisualBriefing',
        systemPrompt: AUDIOVISUAL_BRIEFING_SYSTEM_PROMPT,
        load: (manager) => this.loadRelease(tenantId, releaseId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateAudiovisualBriefingInput,
        buildPrompt: buildAudiovisualBriefingPrompt,
        parseResponse: parseAudiovisualBriefingResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, releaseId, next, manager),
      },
    );
  }

  // ── Persistence (read/write of releases.metadata via DataSource) ────────────

  private async loadRelease(
    tenantId: string,
    releaseId: string,
    manager: EntityManager,
  ): Promise<ReleaseRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT r.title, r.metadata,
              a.nome_artistico AS artist_name
         FROM releases r
         LEFT JOIN artists a
           ON a.id = r.artist_id AND a.tenant_id = r.tenant_id AND a.deleted_at IS NULL
        WHERE r.id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL
        LIMIT 1`,
      [releaseId, tenantId],
    )) as ReleaseRow[];
    return rows?.[0] ?? null;
  }

  private async persistMetadata(
    tenantId: string,
    releaseId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE releases SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), releaseId, tenantId],
    );
  }

  // ── Skill input assembly ────────────────────────────────────────────────────

  private buildInput(release: ReleaseRow): AudiovisualBriefingInput {
    const md = (release.metadata ?? {}) as Record<string, unknown>;

    const mdType = typeof md.audiovisualContentType === 'string' ? md.audiovisualContentType.toLowerCase() : '';
    const contentType: AudiovisualContentType = (CONTENT_TYPES as readonly string[]).includes(mdType)
      ? (mdType as AudiovisualContentType)
      : 'music-video';

    const mdBudget = typeof md.audiovisualBudgetLevel === 'string' ? md.audiovisualBudgetLevel.toLowerCase() : '';
    const budgetLevel: AudiovisualBudgetLevel = (BUDGET_LEVELS as readonly string[]).includes(mdBudget)
      ? (mdBudget as AudiovisualBudgetLevel)
      : 'medium';

    const input: AudiovisualBriefingInput = {
      projectTitle: `${release.title} — Audiovisual`,
      artistName: release.artist_name?.trim() || 'Artista',
      contentType,
      releaseTitle: release.title,
      objective: `Produzir o material audiovisual de lançamento de "${release.title}".`,
      budgetLevel,
      language: 'pt-BR',
    };

    if (typeof md.context === 'string') input.context = md.context;

    return input;
  }
}
