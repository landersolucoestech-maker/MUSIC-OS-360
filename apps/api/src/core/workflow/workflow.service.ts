/**
 * workflow.service.ts
 *
 * Injectable NestJS service that wraps WorkflowEngine instances.
 *
 * Two execution modes:
 *  - transition(req)          → standalone validation + history persist (own connection)
 *  - transitionInTx(req, em)  → validation + history persist inside a caller-managed
 *                               EntityManager/transaction (atomic with entity update)
 */

import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, Repository, EntityManager, FindOptionsWhere, FindOptionsOrder } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { WorkflowTransitionEntity } from '../../database/entities';
import { WorkflowEngine } from './workflow.engine';
import {
  WorkflowDefinition,
  WorkflowContext,
  AllowedTransition,
  WorkflowTransitionError,
} from './workflow.types';

export interface TransitionRequest {
  entityType: string;
  entityId: string;
  tenantId: string;
  actorId: string;
  actorRole?: string;
  fromStatus: string;
  toStatus: string;
  entity: Record<string, unknown>;
  reason?: string;
}

export interface TransitionResult {
  success: boolean;
  fromStatus: string;
  toStatus: string;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private readonly engines = new Map<string, WorkflowEngine<string>>();
  private readonly historyRepo: Repository<WorkflowTransitionEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) ds: DataSource | null) {
    if (ds) {
      this.historyRepo = ds.getRepository(WorkflowTransitionEntity);
    }
  }

  /** Register a workflow definition. Called once per domain at startup via WorkflowBootstrap. */
  register(definition: WorkflowDefinition<string>): void {
    this.engines.set(definition.entityType, new WorkflowEngine(definition));
  }

  /** Returns transitions available to the actor from the current status. */
  getAllowedTransitions(
    entityType: string,
    currentStatus: string,
    actorRole?: string,
  ): AllowedTransition<string>[] {
    const engine = this.engines.get(entityType);
    if (!engine) return [];
    return engine.getAllowedTransitions(currentStatus, actorRole);
  }

  /**
   * Validates and executes a state transition, persisting history.
   * Uses its own repository connection — NOT transactionally safe with the caller's entity update.
   * Use transitionInTx() when you need atomicity with the entity status write.
   */
  async transition(req: TransitionRequest): Promise<TransitionResult> {
    await this.runValidation(req);
    await this.writeHistory(req, this.historyRepo);
    return { success: true, fromStatus: req.fromStatus, toStatus: req.toStatus };
  }

  /**
   * Validates and persists history inside the provided EntityManager.
   * Call this from within a dataSource.transaction() block so that
   * history + entity status write are committed atomically.
   *
   * @example
   *   await dataSource.transaction(async (em) => {
   *     await workflowService.transitionInTx(req, em);
   *     await em.update(MyEntity, { id }, { status: req.toStatus, updated_at: new Date() });
   *   });
   */
  async transitionInTx(req: TransitionRequest, em: EntityManager): Promise<TransitionResult> {
    await this.runValidation(req);
    await this.writeHistory(req, em.getRepository(WorkflowTransitionEntity));
    return { success: true, fromStatus: req.fromStatus, toStatus: req.toStatus };
  }

  /** Returns paginated transition history for an entity. */
  async getHistory(tenantId: string, entityType: string, entityId: string, limit = 50) {
    if (!this.historyRepo) return [];

    const where: FindOptionsWhere<WorkflowTransitionEntity> = {
      tenant_id:   tenantId,
      entity_type: entityType,
      entity_id:   entityId,
    };
    const order: FindOptionsOrder<WorkflowTransitionEntity> = {
      created_at: 'DESC',
    };

    return this.historyRepo.find({ where, order, take: limit });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async runValidation(req: TransitionRequest): Promise<void> {
    const engine = this.engines.get(req.entityType);
    if (!engine) {
      // Server misconfiguration (no workflow registered for this entity type):
      // a plain Error → logged and answered with the generic 500 copy.
      throw new Error(`No workflow registered for entity type '${req.entityType}'`);
    }

    const context: WorkflowContext<string> = {
      entityType: req.entityType,
      entityId:   req.entityId,
      tenantId:   req.tenantId,
      actorId:    req.actorId,
      actorRole:  req.actorRole,
      fromStatus: req.fromStatus,
      toStatus:   req.toStatus,
      entity:     req.entity,
      reason:     req.reason,
    };

    try {
      await engine.transition(context);
    } catch (err) {
      if (err instanceof WorkflowTransitionError) {
        this.logger.warn(`${err.message} (${req.entityType} ${req.entityId}, tenant ${req.tenantId}, code=${err.code})`);
        throw new BadRequestException({
          statusCode: 400,
          error: `WORKFLOW_${err.code.toUpperCase()}`,
          message: err.userMessage,
        });
      }
      throw err;
    }
  }

  private async writeHistory(
    req: TransitionRequest,
    repo: Repository<WorkflowTransitionEntity> | null,
  ): Promise<void> {
    if (!repo) return;

    const entry = repo.create({
      tenant_id:   req.tenantId,
      entity_type: req.entityType,
      entity_id:   req.entityId,
      from_status: req.fromStatus,
      to_status:   req.toStatus,
      actor_id:    req.actorId,
      actor_role:  req.actorRole ?? null,
      reason:      req.reason ?? null,
      metadata:    {},
    });

    await repo.save(entry);
  }
}
