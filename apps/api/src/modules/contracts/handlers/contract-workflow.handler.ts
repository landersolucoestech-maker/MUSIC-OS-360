import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { ContractEntity, CrmTaskEntity } from '../../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../../core/events/events.service';
import { WorkflowQueueService } from '../../../queues/services/workflow-queue.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type {
  ContractExpiringSoonPayload,
  ContractSignedPayload,
} from '../../../core/events/domain-events.types';

const SIGNED_TASKS: ReadonlyArray<{
  title: string;
  description: string;
  priority: string;
  daysFromNow: number;
}> = [
  { title: 'Arquivamento juridico', description: 'Enviar contrato assinado ao departamento juridico', priority: 'high', daysFromNow: 2 },
  { title: 'Lancamento financeiro', description: 'Registrar contrato no sistema financeiro e emitir NF', priority: 'high', daysFromNow: 3 },
  { title: 'Briefing operacional', description: 'Reuniao com equipe para alinhar entregas do contrato', priority: 'medium', daysFromNow: 5 },
  { title: 'Setup de lancamento / metadata', description: 'Configurar releases e metadados do artista na plataforma', priority: 'medium', daysFromNow: 7 },
  { title: 'Configuracao de integracao futura', description: 'Preparar credenciais e mapeamentos para distribuidoras', priority: 'low', daysFromNow: 14 },
];

@Injectable()
export class ContractWorkflowHandler {
  private readonly logger = new Logger(ContractWorkflowHandler.name);
  private readonly contractRepo: Repository<ContractEntity> | null = null;
  private readonly taskRepo: Repository<CrmTaskEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly events: EventsService,
    @Optional() private readonly workflowQueue: WorkflowQueueService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) {
      this.contractRepo = ds.getRepository(ContractEntity);
      this.taskRepo = ds.getRepository(CrmTaskEntity);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_SIGNED)
  async onContractSigned(event: DomainEvent<ContractSignedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { contractId, title, artistId, signedBy, signedAt } = event.payload;
    const now = new Date();
    let valorStr: string | null = null;
    let shouldContinue = true;

    if (this.taskRepo || this.contractRepo) {
      await this.runInTenantContext(tenantId, async (manager) => {
        const taskRepo = manager ? manager.getRepository(CrmTaskEntity) : this.taskRepo;
        const contractRepo = manager ? manager.getRepository(ContractEntity) : this.contractRepo;

        if (taskRepo) {
          try {
            const existing = await taskRepo.findOne({
              where: { tenant_id: tenantId, type: `contract.execution:${contractId}` },
            });
            if (existing) {
              this.logger.debug(`Execution tasks already created for contract "${contractId}" - skipping`);
              shouldContinue = false;
              return;
            }
          } catch (err) {
            this.logger.warn(`Idempotency check failed for contract "${contractId}" - ${String(err)}`);
            shouldContinue = false;
            return;
          }

          try {
            const tasks = SIGNED_TASKS.map((task) => {
              const due = new Date(now);
              due.setDate(due.getDate() + task.daysFromNow);
              return taskRepo.create({
                tenant_id: tenantId,
                title: task.title,
                description: task.description,
                status: 'pending',
                priority: task.priority,
                type: `contract.execution:${contractId}`,
                assigned_to: signedBy,
                due_date: due,
                created_by: signedBy,
              });
            });
            await taskRepo.save(tasks);
            this.logger.log(`Created ${tasks.length} execution tasks for contract "${contractId}" ("${title}")`);
          } catch (err) {
            this.logger.error(`Failed to create execution tasks for "${contractId}" - ${String(err)}`);
          }
        }

        if (contractRepo) {
          try {
            const contract = await contractRepo.findOne({
              where: { id: contractId, tenant_id: tenantId },
            });
            valorStr = contract?.fixed_value ? String(contract.fixed_value) : null;
          } catch {
            // non-fatal
          }
        }
      });
    }

    if (!shouldContinue) return;

    if (this.events) {
      try {
        this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_INTEGRATION_READY, {
          tenantId,
          userId: signedBy,
          aggregateType: 'contract',
          aggregateId: contractId,
          payload: {
            contractId,
            tenantId,
            title,
            artistId: artistId ?? null,
            valor: valorStr,
            readyAt: signedAt,
            integrations: ['distribution', 'financial', 'society-data-exchange'],
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to emit CONTRACT_INTEGRATION_READY for "${contractId}" - ${String(err)}`);
      }
    }

    if (!this.workflowQueue) return;
    try {
      await this.workflowQueue.enqueueWorkflowFollowup({
        tenantId,
        entityType: 'contract',
        entityId: contractId,
        trigger: 'contract.signed',
        correlationId: event.correlationId ?? null,
      });
    } catch (err) {
      this.logger.warn(`Failed to enqueue workflow followup for "${contractId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_EXPIRING_SOON)
  async onContractExpiringSoon(event: DomainEvent<ContractExpiringSoonPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { contractId, title, daysLeft } = event.payload;

    if (this.taskRepo) {
      await this.runInTenantContext(tenantId, async (manager) => {
        const taskRepo = manager ? manager.getRepository(CrmTaskEntity) : this.taskRepo;
        if (!taskRepo) return;

        try {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const existing = await taskRepo
            .createQueryBuilder('t')
            .where('t.tenant_id = :tenantId AND t.type = :type AND t.created_at > :cutoff', {
              tenantId,
              type: `contract.renewal:${contractId}`,
              cutoff,
            })
            .getOne();
          if (existing) return;
        } catch {
          return;
        }

        const due = new Date();
        due.setDate(due.getDate() + Math.max(daysLeft - 5, 1));

        try {
          const task = taskRepo.create({
            tenant_id: tenantId,
            title: `Renovacao de contrato: "${title}"`,
            description: `O contrato vence em ${daysLeft} dias. Iniciar negociacao de renovacao ou encerramento.`,
            status: 'pending',
            priority: daysLeft <= 7 ? 'high' : 'medium',
            type: `contract.renewal:${contractId}`,
            assigned_to: null,
            due_date: due,
            created_by: 'system',
          });
          await taskRepo.save(task);
          this.logger.log(`Created renewal task for contract "${contractId}" (${daysLeft} days remaining)`);
        } catch (err) {
          this.logger.warn(`Failed to create renewal task for "${contractId}" - ${String(err)}`);
        }
      });
    }

    if (!this.workflowQueue) return;
    try {
      await this.workflowQueue.enqueueWorkflowFollowup({
        tenantId,
        entityType: 'contract',
        entityId: contractId,
        trigger: 'contract.expiring_soon',
        correlationId: event.correlationId ?? null,
      });
    } catch (err) {
      this.logger.warn(`Failed to enqueue workflow followup for expiring "${contractId}" - ${String(err)}`);
    }
  }

  private failClosed(eventType: string): void {
    this.logger.warn(`ContractWorkflowHandler: event "${eventType}" sem tenantId - abortado (fail-closed)`);
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
