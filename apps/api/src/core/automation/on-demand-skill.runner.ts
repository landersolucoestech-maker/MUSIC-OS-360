/**
 * core/automation/on-demand-skill.runner.ts
 *
 * Common runner for ON_DEMAND skills — triggered by an explicit user action
 * via a controller (POST), not by a lifecycle domain
 * event. Counterpart of `native-skill-automation.runner.ts` (which is
 * EVENT_DRIVEN, asynchronous, fail-safe/invisible).
 *
 * Deliberate differences from the event-driven runner:
 *   — synchronous: the user is waiting for the HTTP response, so the AI
 *     call happens inside the request and failures ARE rethrown (the controller
 *     decides the error code) — never the fail-safe "swallow and move on".
 *   — no idempotencyKey/metadata guard: there is no entity whose `metadata`
 *     can serve as a guard. Auditing/history live entirely in
 *     `skill_runs` (the existing start/succeed/fail), reusing
 *     `output_payload` — no new table.
 *   — optional staleness (`freshnessMinutes`): when given, reuses
 *     the last SUCCESSFUL execution within the window instead of calling the AI
 *     again (via `SkillRunService.findRecentSuccess`), unless
 *     `forceRefresh` is true. Skills without `freshnessMinutes` always generate.
 *
 * Never writes to any product entity — each result is returned
 * to the caller (controller), which decides whether/how to expose it.
 */

import { Logger } from '@nestjs/common';
import { AIService } from '../../modules/ai/ai.service';
import { SkillRunService } from '../skills/skill-run.service';

const logger = new Logger('OnDemandSkill');

export interface OnDemandSkillDeps {
  skillRun: SkillRunService;
  ai: AIService;
}

export interface OnDemandSkillValidation {
  valid: boolean;
  errors: string[];
}

export interface OnDemandSkillParams<TInput, TOutput> {
  skillName: string;
  tenantId: string;
  userId: string | null;
  /** Entity type/id when the skill is scoped to one (e.g. 'artist'/artistId). null for tenant-level skills. */
  entityType: string | null;
  entityId: string | null;
  systemPrompt: string;
  input: TInput;
  buildPrompt: (input: TInput) => string;
  parseResponse: (content: string, input: TInput) => TOutput;
  validateInput?: (input: TInput) => OnDemandSkillValidation;
  /** Window in minutes to reuse the last successful execution without a new AI call. Omitted = always generates. */
  freshnessMinutes?: number;
  /** Ignores the freshness cache and forces a new generation even within the window. */
  forceRefresh?: boolean;
}

export interface OnDemandSkillResult<TOutput> {
  parsed: TOutput;
  provider: string;
  model: string;
  generatedAt: string;
  fromCache: boolean;
  skillRunId: string;
}

class OnDemandSkillInputError extends Error {}

export async function runOnDemandSkill<TInput, TOutput>(
  deps: OnDemandSkillDeps,
  params: OnDemandSkillParams<TInput, TOutput>,
): Promise<OnDemandSkillResult<TOutput>> {
  const { skillRun, ai } = deps;
  const { skillName, tenantId, entityId } = params;

  if (!tenantId) throw new Error(`[${skillName}] tenantId é obrigatório`);

  if (params.freshnessMinutes && !params.forceRefresh) {
    const recent = await skillRun.findRecentSuccess(tenantId, skillName, entityId ?? null, params.freshnessMinutes);
    const cached = recent?.output_payload as Record<string, unknown> | null;
    if (recent && cached && cached.parsed !== undefined) {
      return {
        parsed: cached.parsed as TOutput,
        provider: String(cached.provider ?? ''),
        model: String(cached.model ?? ''),
        generatedAt: String(cached.generatedAt ?? recent.finished_at ?? ''),
        fromCache: true,
        skillRunId: recent.id,
      };
    }
  }

  const runId = await skillRun.start({
    tenantId,
    userId: params.userId ?? null,
    skillName,
    entityType: params.entityType,
    entityId,
    input: {},
  });

  try {
    const validation = params.validateInput?.(params.input);
    if (validation && !validation.valid) {
      throw new OnDemandSkillInputError(`input inválido: ${validation.errors.join('; ')}`);
    }

    const completion = await ai.complete({
      tenantId,
      userId: params.userId ?? 'system',
      skill: skillName,
      systemPrompt: params.systemPrompt,
      prompt: params.buildPrompt(params.input),
      jsonMode: true,
    });

    const parsed = params.parseResponse(completion.content, params.input);
    const generatedAt = new Date().toISOString();

    await skillRun.succeed(runId, tenantId, skillName, {
      provider: completion.provider,
      model: completion.model,
      generatedAt,
      parsed: parsed as Record<string, unknown>,
    });

    return { parsed, provider: completion.provider, model: completion.model, generatedAt, fromCache: false, skillRunId: runId };
  } catch (err) {
    await skillRun.fail(runId, tenantId, skillName, err);
    logger.warn(`[${skillName}] execução on-demand falhou (run=${runId}): ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
