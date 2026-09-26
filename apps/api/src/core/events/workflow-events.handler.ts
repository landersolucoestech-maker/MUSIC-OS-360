/**
 * workflow-events.handler.ts
 *
 * Dedicated audit-log handler for WORKFLOW_TRANSITIONED events.
 *
 * WorkflowTransitioned →
 *   1. Persist AuditLogEntity with before/after status snapshot.
 *   2. Log structured transition record for observability.
 *
 * This handler receives emissions from ALL domain services that drive
 * workflow state machines (contracts, releases, support-tickets, etc.).
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { AuditLogEntity } from '../../database/entities';
import { DOMAIN_EVENTS } from './events.service';
import type { DomainEvent } from './events.service';
import type { WorkflowTransitionedPayload } from './domain-events.types';

@Injectable()
export class WorkflowEventsHandler {
  private readonly logger = new Logger(WorkflowEventsHandler.name);
  private readonly auditRepo: Repository<AuditLogEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) this.auditRepo = ds.getRepository(AuditLogEntity);
  }

  /**
   * Persists an immutable audit-log entry for every workflow status transition.
   * before/after snapshot captures the full status change for forensic queries.
   */
  @OnEvent(DOMAIN_EVENTS.WORKFLOW_TRANSITIONED, { async: true })
  async onWorkflowTransitioned(event: DomainEvent<WorkflowTransitionedPayload>): Promise<void> {
    const {
      entityType,
      entityId,
      fromStatus,
      toStatus,
      actorId,
      actorRole,
      reason,
      transitionedAt,
    } = event.payload;

    if (!event.tenantId) {
      this.logger.warn(
        `WorkflowEventsHandler: event "${event.type}" without tenantId - aborted (fail-closed)`,
      );
      return;
    }

    this.logger.log(
      `[WORKFLOW_TRANSITIONED] ${entityType}/${entityId}: ${fromStatus} → ${toStatus} by ${actorId} tenant=${event.tenantId}`,
    );

    if (!this.auditRepo) return;

    try {
      await this.runInTenantContext(event.tenantId, async (manager) => {
        const auditRepo = manager ? manager.getRepository(AuditLogEntity) : this.auditRepo;
        if (!auditRepo) return;
        await auditRepo.save(
          auditRepo.create({
            id:         randomUUID(),
            tenant_id:  event.tenantId,
            user_id:    actorId,
            action:     'workflow.transition',
            entity:     entityType,
            entity_id:  entityId,
            before:     { status: fromStatus },
            after:      { status: toStatus },
            ip_address: null,
            user_agent: null,
            request_id: event.correlationId ?? null,
            metadata: {
              fromStatus,
              toStatus,
              actorRole:     actorRole ?? null,
              reason:        reason ?? null,
              transitionedAt,
              correlationId: event.correlationId ?? null,
              source:        'domain_event',
            },
          }),
        );
      });
      this.logger.log(
        `WorkflowEventsHandler: audit entry persisted for ${entityType}/${entityId} (${fromStatus} → ${toStatus})`,
      );
    } catch (err) {
      this.logger.error(
        `WorkflowEventsHandler: failed to persist audit entry for ${entityType}/${entityId} — ${String(err)}`,
      );
    }
  }

  private runInTenantContext<T>(
    tenantId: string,
    work: (manager: EntityManager | undefined) => Promise<T>,
  ): Promise<T> {
    return this.dbContext
      ? this.dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, work)
      : work(undefined);
  }
}
