/**
 * core/automation/launch-strategy.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   release.approved → launch-strategy → saves a SUGGESTION in
 *   releases.metadata.aiLaunchStrategy
 *
 * All common orchestration (metadata + skill_runs idempotency, auditing,
 * envelope, persistence, fail-safe) lives in `runNativeSkillAutomation`. Only
 * the specific parts live here: loading the release, assembling the input and the
 * UPDATE of the `releases` table.
 *
 * release.approved already triggers marketing-calendar-builder (tactical calendar)
 * and audiovisual-briefing (production briefing) — this is the third
 * non-overlapping skill on the same event (see the doc comment of contracts.ts for the
 * scope distinction). Only writes an internal SUGGESTION — does not change the release's
 * official data.
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
  LAUNCH_STRATEGY_SYSTEM_PROMPT,
  buildLaunchStrategyPrompt,
  parseLaunchStrategyResponse,
  validateLaunchStrategyInput,
  type LaunchStrategyInput,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'launch-strategy';

interface ReleaseRow {
  title: string | null;
  type: string | null;
  music_genre: string | null;
  data_lancamento: string | Date | null;
  artist_name: string | null;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class LaunchStrategyAutomation {
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

    await runNativeSkillAutomation<ReleaseRow, LaunchStrategyInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.RELEASE_APPROVED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.approvedBy ?? null,
        entityType: 'release',
        entityId: releaseId,
        metadataKey: 'aiLaunchStrategy',
        systemPrompt: LAUNCH_STRATEGY_SYSTEM_PROMPT,
        load: (manager) => this.loadRelease(tenantId, releaseId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateLaunchStrategyInput,
        buildPrompt: buildLaunchStrategyPrompt,
        parseResponse: parseLaunchStrategyResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, releaseId, next, manager),
      },
    );
  }

  // ── Persistence (read/write of releases.metadata via DataSource) ─────

  private async loadRelease(
    tenantId: string,
    releaseId: string,
    manager: EntityManager,
  ): Promise<ReleaseRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT r.title, r.type, r.music_genre, r.data_lancamento, r.metadata,
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

  // ── Montagem do input da skill ──────────────────────────────────────────────

  private buildInput(r: ReleaseRow): LaunchStrategyInput {
    const md = (r.metadata ?? {}) as Record<string, unknown>;

    const input: LaunchStrategyInput = {
      releaseTitle: r.title?.trim() || 'Lançamento',
      releaseType: r.type?.trim() || 'single',
      language: 'pt-BR',
    };

    if (r.artist_name?.trim()) input.artistName = r.artist_name.trim();
    if (r.music_genre?.trim()) input.genre = r.music_genre.trim();
    if (r.data_lancamento) input.releaseDate = new Date(r.data_lancamento).toISOString();

    // Reuses the content pillars already generated by marketing-calendar-builder,
    // when they exist — real internal data (derived, not rewritten by the model),
    // never invented.
    const calendarEnvelope = md.aiMarketingCalendar as
      | { parsed?: { contentPillars?: Array<{ pillar?: unknown }> } }
      | undefined;
    const pillars = calendarEnvelope?.parsed?.contentPillars;
    if (Array.isArray(pillars) && pillars.length > 0) {
      const names = pillars
        .map((p) => (typeof p.pillar === 'string' ? p.pillar.trim() : ''))
        .filter((p) => p.length > 0);
      if (names.length > 0) {
        input.existingCalendarSummary = `Pilares de conteúdo já planejados: ${names.join(', ')}.`;
      }
    }

    return input;
  }
}
