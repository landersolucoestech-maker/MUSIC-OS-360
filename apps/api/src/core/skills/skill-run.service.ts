/**
 * core/skills/skill-run.service.ts
 *
 * Skill execution runtime — internal infrastructure, INVISIBLE to the user.
 * Persists each execution (skill_runs) and its logs (skill_run_logs), and emits the
 * domain events skill.started / skill.completed / skill.failed.
 *
 * Every operational Skill in the system must run via `run()` to automatically inherit
 * persistence, auditing, logs and traceability.
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

/** Context handed to the skill body during `run()`. */
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

  /** Creates a skill_run in the `running` state and emits skill.started. */
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

  /** Appends a log line to the execution. */
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

  /** Marks the execution as successful and emits skill.completed. */
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

  /** Marks the execution as failed and emits skill.failed. */
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

  /** Lists skill executions (read-only, paginated, tenant-isolated). */
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
   * The most recent SUCCESSFUL execution of this skill (+ entity, when any)
   * within the window in minutes — used by ON_DEMAND skills with
   * stale-refresh semantics (e.g. audience-health) to avoid regenerating via AI on every
   * call. `entityId=null` looks up executions without an entity (tenant level).
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

  /** Detail of an execution + its logs. */
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
   * Runs a skill with full persistence/auditing.
   * start → fn(ctx) → succeed; on error: fail + rethrow.
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
