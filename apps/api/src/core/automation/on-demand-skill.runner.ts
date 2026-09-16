/**
 * core/automation/on-demand-skill.runner.ts
 *
 * Runner comum para skills ON_DEMAND — disparadas por uma ação explícita do
 * usuário via controller (POST), não por um evento de domínio de ciclo de
 * vida. Contraparte de `native-skill-automation.runner.ts` (que é
 * EVENT_DRIVEN, assíncrono, fail-safe/invisível).
 *
 * Diferenças deliberadas em relação ao runner event-driven:
 *   — síncrono: o usuário está esperando a resposta HTTP, então a chamada de
 *     IA acontece dentro da requisição e falhas SÃO relançadas (o controller
 *     decide o código de erro) — nunca o fail-safe "engolir e seguir".
 *   — sem idempotencyKey/guarda de metadata: não há entidade cujo `metadata`
 *     sirva de guarda. A auditoria/histórico vivem inteiramente em
 *     `skill_runs` (start/succeed/fail já existentes), reaproveitando
 *     `output_payload` — nenhuma tabela nova.
 *   — staleness opcional (`freshnessMinutes`): quando informado, reaproveita
 *     a última execução de SUCESSO dentro da janela em vez de chamar a IA de
 *     novo (via `SkillRunService.findRecentSuccess`), a menos que
 *     `forceRefresh` seja true. Skills sem `freshnessMinutes` sempre geram.
 *
 * Nunca escreve em nenhuma entidade de produto — cada resultado é devolvido
 * ao chamador (controller), que decide se/como expor.
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
  /** Tipo/id da entidade quando a skill é escopada a uma (ex.: 'artist'/artistId). null para skills a nível de tenant. */
  entityType: string | null;
  entityId: string | null;
  systemPrompt: string;
  input: TInput;
  buildPrompt: (input: TInput) => string;
  parseResponse: (content: string, input: TInput) => TOutput;
  validateInput?: (input: TInput) => OnDemandSkillValidation;
  /** Janela em minutos para reaproveitar a última execução de sucesso sem nova chamada de IA. Omitido = sempre gera. */
  freshnessMinutes?: number;
  /** Ignora o cache de frescor e força nova geração mesmo dentro da janela. */
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
