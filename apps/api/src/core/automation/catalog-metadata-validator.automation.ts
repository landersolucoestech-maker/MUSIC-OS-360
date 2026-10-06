/**
 * core/automation/catalog-metadata-validator.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   catalog.work.created      → catalog-metadata-validator (type=work)      → works.metadata.aiCatalogValidation
 *   catalog.recording.created → catalog-metadata-validator (type=recording) → phonograms.metadata.aiCatalogValidation
 *
 * A single handler treats both events, keeping each type's own
 * entityType/eventName/idempotencyKey. All common orchestration (metadata + skill_runs idempotency,
 * auditing, envelope, persistence, fail-safe) lives in `runNativeSkillAutomation`.
 *
 * Guarantees inherited from the runner: non-blocking execution, an AI failure never reverts the
 * asset creation, double idempotency guard (recent running/success block;
 * stale running/failed allow a retry), and no side effects (does not approve the catalog,
 * does not change the work/phonogram status, no tasks, no notifications, no new tables).
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type {
  CatalogWorkCreatedPayload,
  CatalogRecordingCreatedPayload,
} from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AiService } from '../../modules/ai/ai.service';
import {
  CATALOG_METADATA_VALIDATOR_SYSTEM_PROMPT,
  buildCatalogMetadataValidatorPrompt,
  parseCatalogMetadataValidatorResponse,
  validateCatalogMetadataValidatorInput,
  type CatalogMetadataValidatorInput,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'catalog-metadata-validator';
const METADATA_KEY = 'aiCatalogValidation';

interface WorkRow {
  title: string;
  composer_name: string | null;
  composer_names: string[] | null;
  publisher_name: string | null;
  isrc: string | null;
  metadata: Record<string, unknown> | null;
}

/** `composer_name` (singular) is a free-text field, still populated by the
 * Reports bulk-import writer path (col()/importable in WORKS_CONTRACT) --
 * split on common separators and merged with `composer_names` (plural,
 * structured, derived from the form's participants), deduplicated by name. */
function splitFreeTextNames(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split(/[;,/\n]+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

interface ParticipationEntry {
  name?: string;
}
interface ParticipationRow {
  phonographic_producers?: ParticipationEntry[];
  performers?: ParticipationEntry[];
}

interface RecordingRow {
  title: string;
  participation: ParticipationRow | null;
  isrc: string | null;
  record_label_name: string | null;
  metadata: Record<string, unknown> | null;
}

/** Non-empty names of a `participation` category (structured jsonb --
 * see ParticipationDto in modules/phonograms/dto/create-phonogram.dto.ts). */
function participantNames(list: ParticipationEntry[] | undefined): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((p) => p?.name?.trim()).filter((n): n is string => !!n);
}

@Injectable()
export class CatalogMetadataValidatorAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AiService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  // ── Obra (work) ─────────────────────────────────────────────────────────────

  @OnEvent(DOMAIN_EVENTS.CATALOG_WORK_CREATED, { async: true })
  async onWorkCreated(event: DomainEvent<CatalogWorkCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const workId = payload?.workId;

    await runNativeSkillAutomation<WorkRow, CatalogMetadataValidatorInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.CATALOG_WORK_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.createdBy ?? null,
        entityType: 'work',
        entityId: workId,
        metadataKey: METADATA_KEY,
        systemPrompt: CATALOG_METADATA_VALIDATOR_SYSTEM_PROMPT,
        load: (manager) => this.loadWork(tenantId, workId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildWorkInput(row),
        validateInput: validateCatalogMetadataValidatorInput,
        buildPrompt: buildCatalogMetadataValidatorPrompt,
        parseResponse: parseCatalogMetadataValidatorResponse,
        saveMetadata: (next, manager) => this.persistWork(tenantId, workId, next, manager),
      },
    );
  }

  // ── Fonograma (recording) ───────────────────────────────────────────────────

  @OnEvent(DOMAIN_EVENTS.CATALOG_RECORDING_CREATED, { async: true })
  async onRecordingCreated(event: DomainEvent<CatalogRecordingCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const recordingId = payload?.recordingId;

    await runNativeSkillAutomation<RecordingRow, CatalogMetadataValidatorInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.CATALOG_RECORDING_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.createdBy ?? null,
        entityType: 'recording',
        entityId: recordingId,
        metadataKey: METADATA_KEY,
        systemPrompt: CATALOG_METADATA_VALIDATOR_SYSTEM_PROMPT,
        load: (manager) => this.loadRecording(tenantId, recordingId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildRecordingInput(row),
        validateInput: validateCatalogMetadataValidatorInput,
        buildPrompt: buildCatalogMetadataValidatorPrompt,
        parseResponse: parseCatalogMetadataValidatorResponse,
        saveMetadata: (next, manager) => this.persistRecording(tenantId, recordingId, next, manager),
      },
    );
  }

  // ── Persistence: works ──────────────────────────────────────────────────────

  private async loadWork(
    tenantId: string,
    workId: string,
    manager: EntityManager,
  ): Promise<WorkRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT title, composer_name, composer_names, publisher_name, isrc, metadata
         FROM works
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        LIMIT 1`,
      [workId, tenantId],
    )) as WorkRow[];
    return rows?.[0] ?? null;
  }

  private async persistWork(
    tenantId: string,
    workId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE works SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), workId, tenantId],
    );
  }

  // ── Persistence: phonograms ─────────────────────────────────────────────────

  private async loadRecording(
    tenantId: string,
    recordingId: string,
    manager: EntityManager,
  ): Promise<RecordingRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT title, participation, isrc, record_label_name, metadata
         FROM phonograms
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        LIMIT 1`,
      [recordingId, tenantId],
    )) as RecordingRow[];
    return rows?.[0] ?? null;
  }

  private async persistRecording(
    tenantId: string,
    recordingId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE phonograms SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), recordingId, tenantId],
    );
  }

  // ── Skill input assembly ────────────────────────────────────────────────────

  private buildWorkInput(work: WorkRow): CatalogMetadataValidatorInput {
    const md = (work.metadata ?? {}) as Record<string, unknown>;
    const composerNames = new Set<string>([
      ...(work.composer_names ?? []),
      ...splitFreeTextNames(work.composer_name),
    ]);
    const input: CatalogMetadataValidatorInput = {
      title: work.title,
      type: 'work',
      composers: [...composerNames].map((name) => ({ name })),
      language: 'pt-BR',
    };
    if (work.publisher_name) input.publisher = work.publisher_name;
    // An ISRC on a work is an inconsistency — passed to the model to point out, if present.
    if (work.isrc) input.isrc = work.isrc;
    if (typeof md.context === 'string') input.context = md.context;
    return input;
  }

  private buildRecordingInput(rec: RecordingRow): CatalogMetadataValidatorInput {
    const md = (rec.metadata ?? {}) as Record<string, unknown>;
    // performers/producers previously read phonograms.interpretes/produtores
    // (legacy free-text columns, dropped by naming-closure Phase 2,
    // 20260923000002_DropDeadWorksPhonogramsLegacyParticipantColumns -- zero
    // writers ever, so this input was already always empty in production).
    // Real participant data lives in phonograms.participation (jsonb object
    // with phonographic_producers/performers/session_musicians array
    // categories -- shape confirmed against PhonogramFormModal.tsx and
    // fixed at the DTO, create-phonogram.dto.ts's ParticipationDto).
    // validateCatalogMetadataValidatorInput() requires a non-empty
    // `performers` for type=recording -- this is not optional enrichment.
    const performers = participantNames(rec.participation?.performers);
    const producers = participantNames(rec.participation?.phonographic_producers);
    const input: CatalogMetadataValidatorInput = {
      title: rec.title,
      type: 'recording',
      performers,
      language: 'pt-BR',
    };
    if (producers.length > 0) input.producers = producers;
    if (rec.isrc) input.isrc = rec.isrc;
    if (rec.record_label_name) input.label = rec.record_label_name;
    if (typeof md.context === 'string') input.context = md.context;
    return input;
  }
}
