import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { ContractEntity, CrmTaskEntity } from '../../../database/entities';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import { FinancialRulesService } from '../../financial-rules/financial-rules.service';
import { DOMAIN_EVENTS } from '../../../core/events/events.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type { TransactionCreatedPayload, TransactionPaidPayload } from '../../../core/events/domain-events.types';
import {
  reconciliationTaskDescription,
  reconciliationTaskTitle,
  transactionPaidCopy,
} from '../i18n/transaction-copy.pt-br';

@Injectable()
export class TransactionEventsHandler {
  private readonly logger = new Logger(TransactionEventsHandler.name);
  private readonly contractRepo: Repository<ContractEntity> | null = null;
  private readonly taskRepo:     Repository<CrmTaskEntity>  | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly activityLogs: ActivityLogsService,
    @Optional() private readonly financialRules: FinancialRulesService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) {
      this.contractRepo = ds.getRepository(ContractEntity);
      this.taskRepo     = ds.getRepository(CrmTaskEntity);
    }
  }

  @OnEvent(DOMAIN_EVENTS.TRANSACTION_CREATED)
  async onTransactionCreated(event: DomainEvent<TransactionCreatedPayload>): Promise<void> {
    const tenantId = event?.tenantId;
    if (!tenantId) {
      this.logger.warn('TransactionEventsHandler: event without tenantId — aborted (fail-closed)');
      return;
    }
    if (!this.financialRules) return;

    const { transactionId, type, category, valor: amountText, source } = event.payload;
    // The provisional transaction created by contract.signed already evaluates rules under
    // that trigger — avoids a duplicate trigger for the same business action.
    if (source === 'contract.signed') return;

    try {
      await this.financialRules.evaluateRules(tenantId, 'transaction.created', {
        entityId: transactionId,
        entityType: 'transaction',
        amount: parseFloat(amountText),
        category,
        type,
      });
    } catch (err) {
      this.logger.warn(`Failed to evaluate financial rules for transaction.created "${transactionId}" — ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.TRANSACTION_PAID)
  async onTransactionPaid(event: DomainEvent<TransactionPaidPayload>): Promise<void> {
    const tenantId = event?.tenantId;
    // Fail-closed: an async handler without a tenant must not touch tenant data.
    if (!tenantId) {
      this.logger.warn('TransactionEventsHandler: event without tenantId — aborted (fail-closed)');
      return;
    }

    const runInContext = <T>(work: (m: EntityManager | undefined) => Promise<T>): Promise<T> =>
      this.dbContext
        ? this.dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, work)
        : work(undefined);

    await runInContext(async (manager) => {
      const contractRepo = manager ? manager.getRepository(ContractEntity) : this.contractRepo;
      const taskRepo     = manager ? manager.getRepository(CrmTaskEntity)  : this.taskRepo;
      const { transactionId, type, contratoId: contractId, valor: amountText, paidBy, paidAt } = event.payload;

      if (this.financialRules) {
        try {
          await this.financialRules.evaluateRules(tenantId, 'transaction.paid', {
            entityId: transactionId,
            entityType: 'transaction',
            amount: parseFloat(amountText),
            type,
          });
        } catch (err) {
          this.logger.warn(`Failed to evaluate financial rules for transaction.paid "${transactionId}" — ${String(err)}`);
        }
      }

      // Update linked contract metadata with last payment info
      if (contractRepo && contractId) {
        try {
          const contract = await contractRepo
            .createQueryBuilder('c')
            .where('c.id = :id AND c.tenant_id = :tenantId AND c.deleted_at IS NULL', {
              id: contractId, tenantId,
            })
            .getOne();

          if (contract) {
            const updatedMetadata = {
              ...contract.metadata,
              ultimo_pagamento_em:    paidAt,
              ultimo_pagamento_valor: amountText,
              ultimo_pagamento_por:   paidBy,
            };
            await contractRepo
              .createQueryBuilder()
              .update(ContractEntity)
              .set({ metadata: updatedMetadata, updated_at: new Date() } as any)
              .where('id = :id AND tenant_id = :tenantId', { id: contractId, tenantId })
              .execute();
            this.logger.log(`Contract "${contractId}" metadata updated after transaction "${transactionId}" paid`);
          }
        } catch (err) {
          this.logger.warn(`Failed to update contract metadata for paid transaction "${transactionId}" — ${String(err)}`);
        }
      }

      // Activity log
      if (this.activityLogs) {
        try {
          await this.activityLogs.create(tenantId, paidBy, {
            entity_type:  'transaction',
            entity_id:    transactionId,
            action:       'paid',
            description:  transactionPaidCopy(amountText),
            metadata:     { valor: amountText, contratoId: contractId, paidAt, correlationId: event.correlationId ?? null },
          });
        } catch { /* non-critical */ }
      }

      // Reconciliation CRM task (one per transaction, idempotent)
      if (taskRepo) {
        try {
          const existing = await taskRepo.findOne({
            where: { tenant_id: tenantId, type: `transaction.reconciliation:${transactionId}` },
          });
          if (!existing) {
            const due = new Date();
            due.setDate(due.getDate() + 5);
            const task = taskRepo.create({
              tenant_id:   tenantId,
              title:       reconciliationTaskTitle(amountText),
              description: reconciliationTaskDescription(amountText, paidAt),
              status:      'pending',
              priority:    'medium',
              type:        `transaction.reconciliation:${transactionId}`,
              assigned_to: paidBy,
              due_date:    due,
              created_by:  paidBy,
            });
            await taskRepo.save(task);
            this.logger.log(`Reconciliation task created for transaction "${transactionId}"`);
          }
        } catch (err) {
          this.logger.warn(`Failed to create reconciliation task for "${transactionId}" — ${String(err)}`);
        }
      }
    });
  }
}
