import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { OperationalTaskEntity } from '../../../database/entities';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import { FinancialRulesService } from '../../financial-rules/financial-rules.service';
import { DOMAIN_EVENTS } from '../../../core/events/events.service';
import {
  invoiceCreatedCopy,
  invoiceIssuedCopy,
  invoiceOverdueCopy,
  invoiceStatusChangedCopy,
  overdueFollowUpTaskDescription,
  overdueFollowUpTaskTitle,
} from '../i18n/invoice-copy.pt-br';
import type { DomainEvent } from '../../../core/events/events.service';
import type {
  InvoiceCreatedPayload,
  InvoiceIssuedPayload,
  InvoiceOverduePayload,
  InvoiceStatusChangedPayload,
} from '../../../core/events/domain-events.types';

@Injectable()
export class InvoiceEventsHandler {
  private readonly logger = new Logger(InvoiceEventsHandler.name);
  private readonly taskRepo: Repository<OperationalTaskEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly activityLogs: ActivityLogsService,
    @Optional() private readonly financialRules: FinancialRulesService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) this.taskRepo = ds.getRepository(OperationalTaskEntity);
  }

  @OnEvent(DOMAIN_EVENTS.INVOICE_CREATED)
  async onInvoiceCreated(event: DomainEvent<InvoiceCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { invoiceId, invoiceNumber, amount, createdBy } = event.payload;
    this.logger.log(`Invoice created: ${invoiceNumber ?? invoiceId} R$${amount}`);

    if (!this.activityLogs || !createdBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, createdBy, {
          entity_type: 'invoice',
          entity_id: invoiceId,
          action: 'created',
          description: invoiceCreatedCopy(invoiceNumber, amount),
          metadata: { amount, invoiceNumber, correlationId: event.correlationId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for invoice created "${invoiceId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.INVOICE_STATUS_CHANGED)
  async onInvoiceStatusChanged(event: DomainEvent<InvoiceStatusChangedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { invoiceId, invoiceNumber, previousStatus, newStatus, changedBy } = event.payload;
    this.logger.log(`Invoice status: ${invoiceNumber ?? invoiceId} ${previousStatus} -> ${newStatus}`);

    if (!this.activityLogs || !changedBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, changedBy, {
          entity_type: 'invoice',
          entity_id: invoiceId,
          action: 'status_changed',
          description: invoiceStatusChangedCopy(invoiceNumber, previousStatus, newStatus),
          metadata: { previousStatus, newStatus, correlationId: event.correlationId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for invoice status change "${invoiceId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.INVOICE_ISSUED)
  async onInvoiceIssued(event: DomainEvent<InvoiceIssuedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { invoiceId, invoiceNumber, amount, issuedBy, issuedAt } = event.payload;
    this.logger.log(`Invoice issued: ${invoiceNumber ?? invoiceId} R$${amount} by ${issuedBy}`);

    if (!this.activityLogs || !issuedBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, issuedBy, {
          entity_type: 'invoice',
          entity_id: invoiceId,
          action: 'issued',
          description: invoiceIssuedCopy(invoiceNumber, amount),
          metadata: { amount, invoiceNumber, issuedAt, correlationId: event.correlationId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for invoice issued "${invoiceId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.INVOICE_OVERDUE)
  async onInvoiceOverdue(event: DomainEvent<InvoiceOverduePayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { invoiceId, invoiceNumber, amount, dueAt: dueDate } = event.payload;
    this.logger.warn(`Invoice overdue: ${invoiceNumber ?? invoiceId} R$${amount} (due ${dueDate})`);

    if (this.financialRules) {
      try {
        await this.financialRules.evaluateRules(tenantId, 'invoice.overdue', {
          entityId: invoiceId,
          entityType: 'invoice',
          amount: parseFloat(amount),
        });
      } catch (err) {
        this.logger.warn(`Failed to evaluate financial rules for invoice.overdue "${invoiceId}" — ${String(err)}`);
      }
    }

    if (this.activityLogs) {
      try {
        await this.runInTenantContext(tenantId, async () => {
          await this.activityLogs!.create(tenantId, 'system', {
            entity_type: 'invoice',
            entity_id: invoiceId,
            action: 'overdue',
            description: invoiceOverdueCopy(invoiceNumber, amount, dueDate),
            metadata: { amount, invoiceNumber, dueAt: dueDate },
          });
        });
      } catch (err) {
        this.logger.warn(`Failed to write activity log for invoice overdue "${invoiceId}" - ${String(err)}`);
      }
    }

    if (!this.taskRepo) return;
    try {
      await this.runInTenantContext(tenantId, async (manager) => {
        const taskRepo = manager ? manager.getRepository(OperationalTaskEntity) : this.taskRepo;
        if (!taskRepo) return;

        const existing = await taskRepo.findOne({
          where: { tenant_id: tenantId, type: `invoice.overdue:${invoiceId}` },
        });
        if (existing) return;

        const due = new Date();
        due.setDate(due.getDate() + 3);
        const task = taskRepo.create({
          tenant_id: tenantId,
          title: overdueFollowUpTaskTitle(invoiceNumber),
          description: overdueFollowUpTaskDescription(amount, dueDate),
          status: 'pending',
          priority: 'high',
          type: `invoice.overdue:${invoiceId}`,
          assigned_to: null,
          due_date: due,
          created_by: 'system',
        });
        await taskRepo.save(task);
        this.logger.log(`Financial follow-up task created for overdue invoice "${invoiceId}"`);
      });
    } catch (err) {
      this.logger.warn(`Failed to create follow-up task for invoice "${invoiceId}" - ${String(err)}`);
    }
  }

  private failClosed(eventType: string): void {
    this.logger.warn(`InvoiceEventsHandler: event "${eventType}" without tenantId - aborted (fail-closed)`);
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
