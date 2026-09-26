/**
 * core/automation/native-skill-automation.runner.ts
 *
 * Common runner for NATIVE, INTERNAL and INVISIBLE AI Skills automations.
 *
 * Centralizes everything that is identical across the event-driven automations
 * (project.completed → project-planning, release.created → release-checklist, …):
 *   — building the idempotencyKey ({event}:{tenant}:{entity});
 *   — DOUBLE idempotency guard: metadata + skill_runs (status success);
 *   — SkillRunService.start/succeed/fail audit cycle;
 *   — AIService.complete call in jsonMode;
 *   — parsing via the @music-os-360/ai-skills package parser (injected by the consumer);
 *   — building the standard ENVELOPE;
 *   — persisting the metadata preserving what exists + defensive history;
 *   — fail-safe: NEVER throws to the event emitter; an AI failure records `fail`
 *     and allows a retry, without reverting the original event and without overwriting a
 *     valid result.
 *
 * Each automation provides only the specific part: loading the record, building the
 * input, the package's prompts/parser and the persistence (UPDATE) of its own table.
 *
 * Does not create real tasks, does not send notifications, does not create tables/migrations.
 */

import { Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AIService } from '../../modules/ai/ai.service';
import { DatabaseContextService } from '../../database/database-context.service';
import { SkillRunService } from '../skills/skill-run.service';

const logger = new Logger('NativeSkillAutomation');

/** Canonical status of the envelope persisted in metadata. */
const ENVELOPE_STATUS_GENERATED = 'generated';

/**
 * Window (minutes) during which a 'running' skill_run still blocks re-execution.
 * A 'running' older than this is considered orphan/stale (the process died
 * before succeed/fail) and does NOT block a retry. 'success' always blocks.
 */
const STALE_RUNNING_MINUTES = 15;

export interface NativeAutomationDeps {
  ds: DataSource | null;
  dbContext?: DatabaseContextService;
  skillRun: SkillRunService;
  ai: AIService;
}

export interface NativeSkillValidation {
  valid: boolean;
  errors: string[];
}

export interface NativeSkillAutomationParams<TRow, TInput> {
  /** Domain event name (e.g. 'project.completed'). Used in the idempotencyKey and the envelope. */
  eventName: string;
  /** Skill name (e.g. 'project-planning'). Used in skill_runs and the envelope. */
  skillName: string;
  /** Tenant do evento. */
  tenantId: string | null | undefined;
  /** Responsible user (for skill_run and AIService). */
  userId: string | null | undefined;
  /** Tipo do agregado (ex.: 'project', 'release'). */
  entityType: string;
  /** ID do agregado. */
  entityId: string | null | undefined;
  /** Key in `metadata` where the envelope is written (e.g. 'aiPlan', 'aiChecklist'). */
  metadataKey: string;
  /** System prompt canônico (do pacote). */
  systemPrompt: string;
  /** Optional eligibility evaluated BEFORE any database access. */
  isEligible?: () => boolean;
  /** Loads the record (incl. metadata). Returns null when it does not exist. */
  load: (manager: EntityManager) => Promise<TRow | null>;
  /** Extracts the metadata object from the loaded record. */
  getMetadata: (row: TRow) => Record<string, unknown>;
  /** Builds the skill input from the record. */
  buildInput: (row: TRow) => TInput;
  /** Optional input validation (from the package). */
  validateInput?: (input: TInput) => NativeSkillValidation;
  /** Builder do user prompt (do pacote). */
  buildPrompt: (input: TInput) => string;
  /** Response parser (from the package). */
  parseResponse: (content: string, input: TInput) => unknown;
  /** Persists the final metadata (a plain UPDATE of its own table). */
  saveMetadata: (nextMetadata: Record<string, unknown>, manager: EntityManager) => Promise<void>;
}

/**
 * Runs a native skill automation end to end, in a fail-safe way.
 * NEVER throws to the event emitter.
 */
export async function runNativeSkillAutomation<TRow, TInput>(
  deps: NativeAutomationDeps,
  params: NativeSkillAutomationParams<TRow, TInput>,
): Promise<void> {
  if (!params.tenantId) {
    logger.warn(`[${params.skillName} automation] evento sem tenantId — abortado (fail-closed)`);
    return;
  }
  if (!deps.dbContext) {
    logger.warn(
      `[${params.skillName} automation] DatabaseContextService indisponivel — abortado (fail-closed)`,
    );
    return;
  }

  try {
    const work = (manager: EntityManager) => execute(deps, params, manager);
    await deps.dbContext.runInTenantContext(
      { tenantId: params.tenantId, orgId: null, role: null },
      work,
    );
  } catch (err) {
    // Errors BEFORE skillRun.start (load/guard/initial persistence). Not propagated.
    await recordPreStartFailure(deps, params, err);
  }
}

/**
 * Observability of pre-start failures (B1): errors occurring before skillRun.start
 * (e.g. load() throws) would leave no trail in skill_runs. Here we record a clear
 * internal log and, when minimal data exists (tenant + entity), open a best-effort
 * skill_run and mark it as `failed` — preserving the audit trail and allowing a retry
 * (status 'failed' does not block). Everything is fail-safe: NEVER throws to the emitter.
 */
async function recordPreStartFailure<TRow, TInput>(
  deps: NativeAutomationDeps,
  params: NativeSkillAutomationParams<TRow, TInput>,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  logger.warn(
    `[${params.skillName} automation] falha pré-start (não-fatal): ${message}`,
  );

  const { tenantId, entityId, skillName } = params;
  // No minimal data or no skill_run runtime → only the log above remains.
  if (!tenantId || !entityId || !deps.skillRun || !deps.dbContext) return;

  try {
    await deps.dbContext.runInTenantContext(
      { tenantId, orgId: null, role: null },
      async () => {
        const idempotencyKey = `${params.eventName}:${tenantId}:${entityId}`;
        const runId = await deps.skillRun.start({
          tenantId,
          userId: params.userId ?? null,
          skillName,
          entityType: params.entityType,
          entityId,
          input: { idempotencyKey, phase: 'pre-start' },
        });
        await deps.skillRun.fail(runId, tenantId, skillName, err);
      },
    );
  } catch {
    // best-effort — if the audit record itself fails, there is nothing more to do.
  }
}

async function execute<TRow, TInput>(
  deps: NativeAutomationDeps,
  params: NativeSkillAutomationParams<TRow, TInput>,
  manager: EntityManager,
): Promise<void> {
  const { ds, skillRun, ai } = deps;
  const { tenantId, entityId, skillName, eventName, metadataKey } = params;

  // 1/2. Validate tenantId and entityId.
  if (!tenantId || !entityId) return;
  // No database → nothing to do (environment without DATA_SOURCE).
  if (!ds) return;

  // 3. OFFICIAL eligibility / cost-control gate (M2).
  // ALWAYS evaluated, before any query/AI call. Automations without their own filter
  // pass through here with `true` (default), keeping a single cost-decision point.
  const eligible = params.isEligible ? params.isEligible() : true;
  if (!eligible) return;

  // 4. Idempotency key.
  const idempotencyKey = `${eventName}:${tenantId}:${entityId}`;

  // 5. Load the record (data + metadata for the idempotency guard).
  const row = await params.load(manager);
  if (!row) return;

  const metadata = params.getMetadata(row);
  const existing = metadata[metadataKey] as Record<string, unknown> | undefined;

  // 6. Idempotency guard (metadata): an envelope generated with this key already exists.
  if (
    existing &&
    existing.idempotencyKey === idempotencyKey &&
    existing.status === ENVELOPE_STATUS_GENERATED
  ) {
    return;
  }

  // 7. Idempotency guard (skill_runs): there is already an IN-PROGRESS ('running')
  // or SUCCESSFUL ('success') execution with this key. Blocking 'running' closes the TOCTOU window
  // between two concurrent events of the same aggregate (M1). Previous failures
  // ('failed'/'cancelled') do NOT block → safe retry.
  if (await hasActiveOrSucceededRun(manager, tenantId, skillName, idempotencyKey)) return;

  // 8. Record the execution (auditable + safe retry).
  const runId = await skillRun.start({
    tenantId,
    userId: params.userId ?? null,
    skillName,
    entityType: params.entityType,
    entityId,
    input: { idempotencyKey },
  });

  try {
    const input = params.buildInput(row);

    const validation = params.validateInput?.(input);
    if (validation && !validation.valid) {
      await skillRun.fail(
        runId, tenantId, skillName,
        new Error(`input inválido: ${validation.errors.join('; ')}`),
      );
      return;
    }

    // AI execution via the backend gateway (OpenAI→Claude→Gemini), in jsonMode.
    const completion = await ai.complete({
      tenantId,
      userId: params.userId ?? 'system',
      skill: skillName,
      systemPrompt: params.systemPrompt,
      prompt: params.buildPrompt(input),
      jsonMode: true,
    });

    const parsed = params.parseResponse(completion.content, input);

    const envelope: Record<string, unknown> = {
      source: 'native-automation',
      skill: skillName,
      event: eventName,
      idempotencyKey,
      automationRunId: runId,
      generatedAt: new Date().toISOString(),
      provider: completion.provider,
      model: completion.model,
      status: ENVELOPE_STATUS_GENERATED,
      parsed,
    };

    await persist(params, metadata, existing, idempotencyKey, envelope, manager);

    await skillRun.succeed(runId, tenantId, skillName, {
      idempotencyKey,
      provider: completion.provider,
      model: completion.model,
      status: ENVELOPE_STATUS_GENERATED,
    });
  } catch (err) {
    // AI/persistence failure: records it and allows a retry; does NOT rethrow and does NOT write
    // the envelope (a valid result is never overwritten by a failure).
    await skillRun.fail(runId, tenantId, skillName, err);
  }
}

/**
 * True when a skill_run already exists that must BLOCK re-execution of this skill with the
 * same idempotencyKey:
 *   - 'success' → always blocks;
 *   - 'running' → blocks only if RECENT (started_at within the
 *     STALE_RUNNING_MINUTES window). An older 'running' is orphan/stale and does NOT block,
 *     allowing a retry after a previous process died.
 * 'failed'/'cancelled' never block.
 */
async function hasActiveOrSucceededRun(
  manager: EntityManager,
  tenantId: string,
  skillName: string,
  idempotencyKey: string,
): Promise<boolean> {
  const rows = (await manager.query(
    `SELECT 1
       FROM skill_runs
      WHERE tenant_id = $1
        AND skill_name = $2
        AND input_payload->>'idempotencyKey' = $3
        AND (
          status = 'success'
          OR (status = 'running' AND started_at >= NOW() - ($4 || ' minutes')::interval)
        )
      LIMIT 1`,
    [tenantId, skillName, idempotencyKey, String(STALE_RUNNING_MINUTES)],
  )) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Builds the final metadata preserving what exists and the defensive history, and delegates
 * the UPDATE to the consumer. The history (`${metadataKey}History`) is only populated when
 * there was a previous envelope with a different idempotency key — normally a
 * no-op, since the key is stable per entity.
 */
async function persist<TRow, TInput>(
  params: NativeSkillAutomationParams<TRow, TInput>,
  metadata: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
  idempotencyKey: string,
  envelope: Record<string, unknown>,
  manager: EntityManager,
): Promise<void> {
  const next: Record<string, unknown> = { ...metadata };

  if (existing && existing.idempotencyKey !== idempotencyKey) {
    const historyKey = `${params.metadataKey}History`;
    const history = Array.isArray(metadata[historyKey]) ? (metadata[historyKey] as unknown[]) : [];
    next[historyKey] = [...history, existing];
  }
  next[params.metadataKey] = envelope;

  await params.saveMetadata(next, manager);
}
