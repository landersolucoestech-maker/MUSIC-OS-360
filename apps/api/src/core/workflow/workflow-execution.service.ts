/**
 * core/workflow/workflow-execution.service.ts
 *
 * Persistence and traceability of the Workflow Automation Engine executions.
 * Every rule trigger generates a workflow_executions row; every action generates a
 * workflow_execution_logs row. Emits workflow.execution.started/completed/failed.
 *
 * Internal infrastructure — invisible to the end user.
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { WorkflowExecutionEntity, WorkflowExecutionLogEntity } from '../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../events/events.service';
import { CorrelationContext } from '../events/correlation.context';

export type ExecutionStatus = 'running' | 'success' | 'failed' | 'partial' | 'cancelled';
export type ActionLogStatus = 'success' | 'failed' | 'skipped';

export interface ExecutionStartParams {
  tenantId: string;
  ruleId: string;
  ruleName: string;
  eventType: string;
  actionsTotal: number;
}

export interface ExecutionFinishParams {
  tenantId: string;
  ruleId: string;
  succeeded: number;
  failed: number;
  error?: string | null;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);
  private readonly execRepo: Repository<WorkflowExecutionEntity> | null = null;
  private readonly logRepo: Repository<WorkflowExecutionLogEntity> | null = null;

  constructor(
    @Optional() @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly events: EventsService,
  ) {
    if (ds) {
      this.execRepo = ds.getRepository(WorkflowExecutionEntity);
      this.logRepo = ds.getRepository(WorkflowExecutionLogEntity);
    }
  }

  async start(params: ExecutionStartParams): Promise<string> {
    this.assertTenantId(params.tenantId);
    const startedAt = new Date();
    let executionId = '';
    if (this.execRepo) {
      const saved = await this.execRepo.save(
        this.execRepo.create({
          tenant_id: params.tenantId,
          rule_id: params.ruleId,
          rule_name: params.ruleName,
          event_type: params.eventType,
          correlation_id: CorrelationContext.get() ?? null,
          status: 'running',
          actions_total: params.actionsTotal,
          started_at: startedAt,
        }),
      );
      executionId = saved.id;
    }
    this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_EXECUTION_STARTED, {
      tenantId: params.tenantId,
      aggregateType: 'workflow_execution',
      aggregateId: executionId,
      payload: {
        executionId,
        tenantId: params.tenantId,
        ruleId: params.ruleId,
        eventType: params.eventType,
        startedAt: startedAt.toISOString(),
      },
    });
    return executionId;
  }

  async logAction(
    executionId: string,
    tenantId: string,
    actionType: string,
    status: ActionLogStatus,
    message?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    if (!this.logRepo || !executionId) return;
    await this.logRepo.save(
      this.logRepo.create({
        execution_id: executionId,
        action_type: actionType,
        status,
        message: message ?? null,
        payload: payload ?? null,
      }),
    );
  }

  async finish(executionId: string, params: ExecutionFinishParams): Promise<ExecutionStatus> {
    this.assertTenantId(params.tenantId);
    const finishedAt = new Date();
    const status: ExecutionStatus =
      params.failed === 0 ? 'success' : params.succeeded === 0 ? 'failed' : 'partial';

    let durationMs = 0;
    if (this.execRepo && executionId) {
      const exec = await this.execRepo.findOne({ where: { id: executionId } });
      if (exec?.started_at) durationMs = finishedAt.getTime() - new Date(exec.started_at).getTime();
      await this.execRepo.update(
        { id: executionId },
        {
          status,
          actions_succeeded: params.succeeded,
          actions_failed: params.failed,
          error_message: params.error ?? null,
          finished_at: finishedAt,
        },
      );
    }

    if (status === 'failed') {
      this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_EXECUTION_FAILED, {
        tenantId: params.tenantId,
        aggregateType: 'workflow_execution',
        aggregateId: executionId,
        payload: {
          executionId,
          tenantId: params.tenantId,
          ruleId: params.ruleId,
          errorMessage: params.error ?? 'Todas as ações falharam',
          finishedAt: finishedAt.toISOString(),
        },
      });
    } else {
      this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_EXECUTION_COMPLETED, {
        tenantId: params.tenantId,
        aggregateType: 'workflow_execution',
        aggregateId: executionId,
        payload: {
          executionId,
          tenantId: params.tenantId,
          ruleId: params.ruleId,
          status,
          actionsSucceeded: params.succeeded,
          actionsFailed: params.failed,
          durationMs,
          finishedAt: finishedAt.toISOString(),
        },
      });
    }
    return status;
  }

  private assertTenantId(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new Error('Workflow execution requires tenantId');
    }
  }

  /** Lists executions (read-only, paginated, tenant-isolated). */
  async list(
    tenantId: string,
    opts: { ruleId?: string; status?: string; limit?: number; offset?: number } = {},
  ): Promise<{ data: WorkflowExecutionEntity[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(Math.max(Number(opts.limit) || 25, 1), 100);
    const offset = Math.max(Number(opts.offset) || 0, 0);
    if (!this.execRepo) return { data: [], total: 0, limit, offset };
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (opts.ruleId) where.rule_id = opts.ruleId;
    if (opts.status) where.status = opts.status;
    const [data, total] = await this.execRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  /** Detail of an execution + action logs. */
  async get(
    tenantId: string,
    executionId: string,
  ): Promise<{ execution: WorkflowExecutionEntity; logs: WorkflowExecutionLogEntity[] } | null> {
    if (!this.execRepo) return null;
    const execution = await this.execRepo.findOne({ where: { id: executionId, tenant_id: tenantId } });
    if (!execution) return null;
    const logs = this.logRepo
      ? await this.logRepo.find({ where: { execution_id: executionId }, order: { created_at: 'ASC' } })
      : [];
    return { execution, logs };
  }
}
