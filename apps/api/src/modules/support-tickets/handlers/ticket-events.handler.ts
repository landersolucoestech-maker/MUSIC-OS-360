import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { NotificationEntity, SupportTicketEntity } from '../../../database/entities';
import { DOMAIN_EVENTS } from '../../../core/events/events.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type { TicketResolvedPayload } from '../../../core/events/domain-events.types';

@Injectable()
export class TicketEventsHandler {
  private readonly logger = new Logger(TicketEventsHandler.name);
  private readonly ticketRepo: Repository<SupportTicketEntity> | null = null;
  private readonly notifRepo: Repository<NotificationEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) {
      this.ticketRepo = ds.getRepository(SupportTicketEntity);
      this.notifRepo = ds.getRepository(NotificationEntity);
    }
  }

  @OnEvent(DOMAIN_EVENTS.TICKET_RESOLVED)
  async onTicketResolved(event: DomainEvent<TicketResolvedPayload>): Promise<void> {
    const tenantId = event.tenantId ?? event.payload.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { ticketId, title, resolvedBy, resolvedAt } = event.payload;
    let slaCompliant: boolean | null = null;
    let createdBy: string | null = null;

    if (this.ticketRepo || this.notifRepo) {
      await this.runInTenantContext(tenantId, async (manager) => {
        const ticketRepo = manager ? manager.getRepository(SupportTicketEntity) : this.ticketRepo;
        const notifRepo = manager ? manager.getRepository(NotificationEntity) : this.notifRepo;

        if (ticketRepo) {
          try {
            const ticket = await ticketRepo.findOne({
              where: { id: ticketId, tenant_id: tenantId },
              select: ['id', 'sla_deadline', 'created_by', 'metadata'],
            });

            if (ticket) {
              createdBy = ticket.created_by;

              if (ticket.sla_deadline) {
                const resolvedDate = new Date(resolvedAt);
                const slaDeadline = new Date(ticket.sla_deadline);
                slaCompliant = resolvedDate <= slaDeadline;
              }

              await ticketRepo.update(
                { id: ticketId, tenant_id: tenantId },
                {
                  resolved_at: new Date(resolvedAt),
                  status: 'resolved',
                  metadata: {
                    ...ticket.metadata,
                    resolvedBy,
                    slaCompliant: slaCompliant ?? null,
                    correlationId: event.correlationId ?? null,
                  },
                } as any,
              );
              this.logger.log(
                `TicketEventsHandler: ticket "${ticketId}" resolved by "${resolvedBy}" slaCompliant=${slaCompliant ?? 'N/A'}`,
              );
            }
          } catch (err) {
            this.logger.error(
              `TicketEventsHandler: failed to update ticket "${ticketId}" resolved_at - ${String(err)}`,
            );
          }
        }

        if (notifRepo && createdBy) {
          try {
            const slaText = slaCompliant === null
              ? ''
              : slaCompliant
                ? ' (dentro do SLA)'
                : ' (fora do SLA)';

            await notifRepo.save(
              notifRepo.create({
                id: randomUUID(),
                tenant_id: tenantId,
                user_id: createdBy,
                title: `Seu ticket foi resolvido: "${title}"${slaText}`,
                body: `Ticket resolvido por ${resolvedBy} em ${resolvedAt}. Por favor avalie o atendimento.`,
                type: DOMAIN_EVENTS.TICKET_RESOLVED,
                entity: 'support_ticket',
                entity_id: ticketId,
                read_at: null,
                metadata: {
                  resolvedBy,
                  resolvedAt,
                  slaCompliant: slaCompliant ?? null,
                  recipient: 'requester',
                  correlationId: event.correlationId ?? null,
                },
              }),
            );
            this.logger.log(
              `TicketEventsHandler: requester notification persisted for ticket "${ticketId}" -> user="${createdBy}"`,
            );
          } catch (err) {
            this.logger.error(
              `TicketEventsHandler: failed to persist resolved notification for ticket "${ticketId}" - ${String(err)}`,
            );
          }
        }
      });
    }
  }

  private failClosed(eventType: string): void {
    this.logger.warn(`TicketEventsHandler: event "${eventType}" without tenantId - aborted (fail-closed)`);
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
