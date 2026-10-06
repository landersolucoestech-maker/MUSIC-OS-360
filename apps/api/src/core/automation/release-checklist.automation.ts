/**
 * core/automation/release-checklist.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   release.created → release-checklist → saves the audit in releases.metadata.aiChecklist
 *
 * All common orchestration (metadata + skill_runs idempotency, auditing,
 * envelope, persistence, fail-safe) lives in `runNativeSkillAutomation`. Only the
 * specific parts live here: loading the release (with the artist name), assembling the
 * input and the UPDATE of the `releases` table.
 *
 * Guarantees inherited from the runner: non-blocking execution, an AI failure never reverts
 * release.created, double idempotency guard, and no side effects (no
 * real tasks, no notifications, no new tables).
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { ReleaseCreatedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AiService } from '../../modules/ai/ai.service';
import {
  RELEASE_CHECKLIST_SYSTEM_PROMPT,
  buildReleaseChecklistPrompt,
  parseReleaseChecklistResponse,
  validateReleaseChecklistInput,
  type ReleaseChecklistInput,
  type ReleaseType,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'release-checklist';

/** Release types accepted by the skill (aligns releases.type's free varchar). */
const KNOWN_RELEASE_TYPES: readonly ReleaseType[] = ['single', 'ep', 'album', 'mixtape', 'video', 'other'];

/**
 * Maps the canonical release `type` (album/ep/single/compilation/live/video/
 * other; legacy Portuguese values migrated by 20260928000016/-19) to the skill
 * enum; types the skill does not know fall back to "other".
 */
function mapReleaseType(type: string | null | undefined): ReleaseType {
  const t = (type ?? '').trim().toLowerCase();
  return (KNOWN_RELEASE_TYPES as readonly string[]).includes(t) ? (t as ReleaseType) : 'other';
}

interface ReleaseRow {
  title: string;
  type: string | null;
  release_date: string | Date | null;
  upc: string | null;
  cover_url: string | null;
  artist_id: string | null;
  artist_name: string | null;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class ReleaseChecklistAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AiService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.RELEASE_CREATED, { async: true })
  async onReleaseCreated(event: DomainEvent<ReleaseCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const releaseId = payload?.releaseId;

    await runNativeSkillAutomation<ReleaseRow, ReleaseChecklistInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.RELEASE_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.createdBy ?? null,
        entityType: 'release',
        entityId: releaseId,
        metadataKey: 'aiChecklist',
        systemPrompt: RELEASE_CHECKLIST_SYSTEM_PROMPT,
        load: (manager) => this.loadRelease(tenantId, releaseId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateReleaseChecklistInput,
        buildPrompt: buildReleaseChecklistPrompt,
        parseResponse: parseReleaseChecklistResponse,
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
      `SELECT r.title, r.type, r.release_date, r.upc, r.cover_url, r.artist_id, r.metadata,
              a.stage_name AS artist_name
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

  private buildInput(release: ReleaseRow): ReleaseChecklistInput {
    const md = (release.metadata ?? {}) as Record<string, unknown>;
    const flag = (key: string): boolean => md[key] === true;

    const input: ReleaseChecklistInput = {
      releaseTitle: release.title,
      artistName: release.artist_name?.trim() || 'Artista não identificado',
      releaseType: mapReleaseType(release.type),
      hasCover: release.cover_url != null,
      hasIsrc: flag('hasIsrc'),
      hasUpc: release.upc != null,
      hasContracts: flag('hasContracts'),
      hasSplits: flag('hasSplits'),
      hasMarketingPlan: flag('hasMarketingPlan'),
      language: 'pt-BR',
    };

    if (release.release_date) input.releaseDate = new Date(release.release_date).toISOString();
    if (typeof md.context === 'string') input.context = md.context;

    return input;
  }
}
