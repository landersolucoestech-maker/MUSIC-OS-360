/**
 * core/skills/skill-run.service.ts
 *
 * Runtime de execução de Skills — infraestrutura interna e INVISÍVEL ao usuário.
 * Persiste cada execução (skill_runs) e seus logs (skill_run_logs), e emite os
 * eventos de domínio skill.started / skill.completed / skill.failed.
 *
 * Toda Skill operacional do sistema deve executar via `run()` para herdar
 * persistência, auditoria, logs e rastreabilidade automaticamente.
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { SkillRunEntity, SkillRunLogEntity } from '../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../events/events.service';
import { CorrelationContext } from '../events/correlation.context';

export type SkillRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type SkillLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SkillRunStartParams {
  tenantId: string;
  userId?: string | null;
  skillName: string;
  entityType?: string | null;
  entityId?: string | null;
  correlationId?: string | null;
  input?: Record<string, unknown>;
}

/** Contexto entregue ao corpo da skill durante `run()`. */
export interface SkillRunContext {
  runId: string;
  log: (level: SkillLogLevel, message: string, payload?: Record<string, unknown>) => Promise<void>;
}

@Injectable()
export class SkillRunService {
  private readonly logger = new Logger(SkillRunService.name);
  private readonly runRepo: Repository<SkillRunEntity> | null = null;
  private readonly logRepo: Repository<SkillRunLogEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly events: EventsService,
  ) {
    if (ds) {
      this.runRepo = ds.getRepository(SkillRunEntity);
      this.logRepo = ds.getRepository(SkillRunLogEntity);
    }
  }

  /** Cria um skill_run em estado `running` e emite skill.started. */
  async start(params: SkillRunStartParams): Promise<string> {
    const correlationId = params.correlationId ?? CorrelationContext.get() ?? null;
    const startedAt = new Date();

    let runId = '';
    if (this.runRepo) {
      const entity = this.runRepo.create({
        tenant_id: params.tenantId,
        user_id: params.userId ?? null,
        skill_name: params.skillName,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        correlation_id: correlationId,
        status: 'running',
        input_payload: params.input ?? {},
        started_at: startedAt,
      });
      const saved = await this.runRepo.save(entity);
      runId = saved.id;
    }

    this.events.emitTyped(DOMAIN_EVENTS.SKILL_STARTED, {
      tenantId: params.tenantId,
      userId: params.userId ?? undefined,
      aggregateType: 'skill_run',
      aggregateId: runId,
      payload: {
        skillRunId: runId,
        tenantId: params.tenantId,
        skillName: params.skillName,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        startedAt: startedAt.toISOString(),
      },
    });

    return runId;
  }

  /** Acrescenta uma linha de log à execução. */
  async log(
    runId: string,
    level: SkillLogLevel,
    message: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.logRepo || !runId) return;
    const entity = this.logRepo.create({
      skill_run_id: runId,
      level,
      message,
      payload: payload ?? null,
    });
    await this.logRepo.save(entity);
  }

  /** Marca a execução como sucesso e emite skill.completed. */
  async succeed(
    runId: string,
    tenantId: string,
    skillName: string,
    output?: Record<string, unknown>,
  ): Promise<void> {
    const finishedAt = new Date();
    let durationMs = 0;
    if (this.runRepo && runId) {
      const run = await this.runRepo.findOne({ where: { id: runId } });
      if (run?.started_at) durationMs = finishedAt.getTime() - new Date(run.started_at).getTime();
      await this.runRepo.update(
        { id: runId },
        { status: 'success', finished_at: finishedAt, output_payload: output ?? null } as never,
      );
    }
    this.events.emitTyped(DOMAIN_EVENTS.SKILL_COMPLETED, {
      tenantId,
      aggregateType: 'skill_run',
      aggregateId: runId,
      payload: { skillRunId: runId, tenantId, skillName, durationMs, finishedAt: finishedAt.toISOString() },
    });
  }

  /** Marca a execução como falha e emite skill.failed. */
  async fail(runId: string, tenantId: string, skillName: string, error: unknown): Promise<void> {
    const finishedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (this.runRepo && runId) {
      await this.runRepo.update(
        { id: runId },
        { status: 'failed', finished_at: finishedAt, error_message: errorMessage },
      );
    }
    await this.log(runId, 'error', errorMessage).catch(() => undefined);
    this.events.emitTyped(DOMAIN_EVENTS.SKILL_FAILED, {
      tenantId,
      aggregateType: 'skill_run',
      aggregateId: runId,
      payload: { skillRunId: runId, tenantId, skillName, errorMessage, finishedAt: finishedAt.toISOString() },
    });
  }

  /** Lista execuções de skills (read-only, paginado, isolado por tenant). */
  async listRuns(
    tenantId: string,
    opts: { skillName?: string; status?: string; limit?: number; offset?: number } = {},
  ): Promise<{ data: SkillRunEntity[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(Math.max(Number(opts.limit) || 25, 1), 100);
    const offset = Math.max(Number(opts.offset) || 0, 0);
    if (!this.runRepo) return { data: [], total: 0, limit, offset };

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (opts.skillName) where.skill_name = opts.skillName;
    if (opts.status) where.status = opts.status;

    const [data, total] = await this.runRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  /**
   * Execução de SUCESSO mais recente desta skill (+ entidade, quando houver)
   * dentro da janela em minutos — usado por skills ON_DEMAND com semântica
   * stale-refresh (ex.: audience-health) para evitar regerar via IA a cada
   * chamada. `entityId=null` busca execuções sem entidade (nível tenant).
   */
  async findRecentSuccess(
    tenantId: string,
    skillName: string,
    entityId: string | null,
    withinMinutes: number,
  ): Promise<SkillRunEntity | null> {
    if (!this.runRepo) return null;
    const qb = this.runRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.skill_name = :skillName', { skillName })
      .andWhere("r.status = 'success'")
      .andWhere(`r.finished_at >= NOW() - (:mins || ' minutes')::interval`, { mins: withinMinutes })
      .orderBy('r.finished_at', 'DESC');
    qb.andWhere(entityId ? 'r.entity_id = :entityId' : 'r.entity_id IS NULL', entityId ? { entityId } : {});
    return qb.getOne();
  }

  /** Detalhe de uma execução + seus logs. */
  async getRun(
    tenantId: string,
    runId: string,
  ): Promise<{ run: SkillRunEntity; logs: SkillRunLogEntity[] } | null> {
    if (!this.runRepo) return null;
    const run = await this.runRepo.findOne({ where: { id: runId, tenant_id: tenantId } });
    if (!run) return null;
    const logs = this.logRepo
      ? await this.logRepo.find({ where: { skill_run_id: runId }, order: { created_at: 'ASC' } })
      : [];
    return { run, logs };
  }

  /**
   * Executa uma skill com persistência/auditoria completas.
   * start → fn(ctx) → succeed; em erro: fail + rethrow.
   */
  async run<T>(
    params: SkillRunStartParams,
    fn: (ctx: SkillRunContext) => Promise<{ result: T; output?: Record<string, unknown> }>,
  ): Promise<T> {
    const runId = await this.start(params);
    const ctx: SkillRunContext = {
      runId,
      log: (level, message, payload) => this.log(runId, level, message, payload),
    };
    try {
      const { result, output } = await fn(ctx);
      await this.succeed(runId, params.tenantId, params.skillName, output);
      return result;
    } catch (err) {
      await this.fail(runId, params.tenantId, params.skillName, err);
      this.logger.error(`Skill "${params.skillName}" falhou (run=${runId})`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }
}
