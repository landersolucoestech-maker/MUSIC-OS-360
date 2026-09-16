/**
 * notification.handler.ts
 *
 * Responsible only for user-facing notifications.
 * Event-log persistence is handled by UniversalEventLogHandler.
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RealtimeService } from '../realtime/realtime.service';
import { DOMAIN_EVENTS } from './events.service';
import { CorrelationContext } from './correlation.context';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { NotificationEntity } from '../../database/entities';
import type { DomainEvent } from './events.service';

const EVENT_LABELS: Record<string, (p: Record<string, unknown>) => string> = {
  [DOMAIN_EVENTS.ARTIST_CREATED]: (p) => `Artista criado: ${p['nomeArtistico'] ?? ''}`,
  [DOMAIN_EVENTS.ARTIST_UPDATED]: (p) => `Artista atualizado: ${p['nomeArtistico'] ?? ''}`,
  [DOMAIN_EVENTS.ARTIST_STATUS_CHANGED]: (p) => `Artista "${p['nomeArtistico'] ?? ''}" -> ${p['newStatus'] ?? ''}`,
  [DOMAIN_EVENTS.ARTIST_DELETED]: (p) => `Artista removido: ${p['nomeArtistico'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_CREATED]: (p) => `Contrato criado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_STATUS_CHANGED]: (p) => `Contrato "${p['title'] ?? ''}" -> ${p['newStatus'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_SENT_FOR_SIGNATURE]: (p) => `Contrato enviado para assinatura: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_CANCELLED]: (p) => `Contrato cancelado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_EXPIRING_SOON]: (p) => `Contrato vencendo em ${p['daysLeft'] ?? '?'} dias: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_SIGNED]: (p) => `Contrato assinado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_EXPIRED]: (p) => `Contrato vencido: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.RELEASE_PUBLISHED]: (p) => `Lancamento publicado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.RELEASE_APPROVED]: (p) => `Lancamento aprovado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.RELEASE_DISTRIBUTED]: (p) => `Lancamento distribuido: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CAMPAIGN_STARTED]: (p) => `Campanha iniciada: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CAMPAIGN_ENDED]: (p) => `Campanha encerrada: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.LEAD_CONVERTED]: (p) => `Lead convertido: ${p['nome'] ?? ''}`,
  [DOMAIN_EVENTS.TICKET_RESOLVED]: (p) => `Ticket resolvido: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.WORKFLOW_TRANSITIONED]: (p) => `Transicao: ${p['entityType'] ?? ''} -> ${p['toStatus'] ?? ''}`,
  [DOMAIN_EVENTS.TRANSACTION_CREATED]: (p) => `Transaccao criada: ${p['type'] ?? ''} R$${p['valor'] ?? ''}`,
  [DOMAIN_EVENTS.TRANSACTION_STATUS_CHANGED]: (p) => `Transaccao "${p['transactionId'] ?? ''}" -> ${p['newStatus'] ?? ''}`,
  [DOMAIN_EVENTS.TRANSACTION_PAID]: (p) => `Pagamento baixado: R$${p['valor'] ?? ''}`,
  [DOMAIN_EVENTS.TRANSACTION_CANCELLED]: (p) => `Transaccao cancelada: R$${p['valor'] ?? ''}`,
  [DOMAIN_EVENTS.INVOICE_CREATED]: (p) => `Nota fiscal criada: ${p['numero'] ?? p['invoiceId'] ?? ''}`,
  [DOMAIN_EVENTS.INVOICE_STATUS_CHANGED]: (p) => `Nota fiscal "${p['numero'] ?? ''}" -> ${p['newStatus'] ?? ''}`,
  [DOMAIN_EVENTS.INVOICE_ISSUED]: (p) => `Nota fiscal emitida: ${p['numero'] ?? ''}`,
  [DOMAIN_EVENTS.INVOICE_OVERDUE]: (p) => `Nota fiscal vencida: ${p['numero'] ?? ''} (${p['dataVencimento'] ?? ''})`,
  [DOMAIN_EVENTS.FINANCIAL_RULE_TRIGGERED]: (p) => `Regra financeira disparada: ${p['ruleName'] ?? ''}`,
  [DOMAIN_EVENTS.ARTIST_ONBOARDING_STARTED]: (p) => `Onboarding iniciado: ${p['nomeArtistico'] ?? ''}`,
  [DOMAIN_EVENTS.DISTRIBUTION_SETUP_REQUESTED]: (p) => `Setup distribuicao solicitado: artista ${p['artistId'] ?? ''}`,
  [DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_REQUESTED]: (p) => `Troca de dados externa solicitada: artista ${p['artistId'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_INTEGRATION_READY]: (p) => `Contrato pronto para integracao: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.ASSET_UPLOADED]: (p) => `Ficheiro enviado: ${p['fileName'] ?? ''}`,
  [DOMAIN_EVENTS.TENANT_CREATED]: (p) => `Conta criada: ${p['name'] ?? ''}`,
  [DOMAIN_EVENTS.USER_INVITED]: (p) => `Utilizador convidado: ${p['email'] ?? ''}`,
  [DOMAIN_EVENTS.TAKEDOWN_REQUESTED]: (p) => `Takedown solicitado: ${p['entityId'] ?? ''}`,
};

const EVENT_AGGREGATE: Record<string, string> = {
  [DOMAIN_EVENTS.ARTIST_CREATED]: 'artist',
  [DOMAIN_EVENTS.ARTIST_UPDATED]: 'artist',
  [DOMAIN_EVENTS.ARTIST_STATUS_CHANGED]: 'artist',
  [DOMAIN_EVENTS.ARTIST_DELETED]: 'artist',
  [DOMAIN_EVENTS.CONTRACT_CREATED]: 'contract',
  [DOMAIN_EVENTS.CONTRACT_STATUS_CHANGED]: 'contract',
  [DOMAIN_EVENTS.CONTRACT_SENT_FOR_SIGNATURE]: 'contract',
  [DOMAIN_EVENTS.CONTRACT_CANCELLED]: 'contract',
  [DOMAIN_EVENTS.CONTRACT_EXPIRING_SOON]: 'contract',
  [DOMAIN_EVENTS.CONTRACT_SIGNED]: 'contract',
  [DOMAIN_EVENTS.CONTRACT_EXPIRED]: 'contract',
  [DOMAIN_EVENTS.RELEASE_PUBLISHED]: 'release',
  [DOMAIN_EVENTS.RELEASE_APPROVED]: 'release',
  [DOMAIN_EVENTS.RELEASE_DISTRIBUTED]: 'release',
  [DOMAIN_EVENTS.CAMPAIGN_STARTED]: 'campaign',
  [DOMAIN_EVENTS.CAMPAIGN_ENDED]: 'campaign',
  [DOMAIN_EVENTS.LEAD_CONVERTED]: 'lead',
  [DOMAIN_EVENTS.TICKET_RESOLVED]: 'support_ticket',
  [DOMAIN_EVENTS.WORKFLOW_TRANSITIONED]: 'workflow',
  [DOMAIN_EVENTS.TRANSACTION_CREATED]: 'transaction',
  [DOMAIN_EVENTS.TRANSACTION_STATUS_CHANGED]: 'transaction',
  [DOMAIN_EVENTS.TRANSACTION_PAID]: 'transaction',
  [DOMAIN_EVENTS.TRANSACTION_CANCELLED]: 'transaction',
  [DOMAIN_EVENTS.INVOICE_CREATED]: 'invoice',
  [DOMAIN_EVENTS.INVOICE_STATUS_CHANGED]: 'invoice',
  [DOMAIN_EVENTS.INVOICE_ISSUED]: 'invoice',
  [DOMAIN_EVENTS.INVOICE_OVERDUE]: 'invoice',
  [DOMAIN_EVENTS.FINANCIAL_RULE_TRIGGERED]: 'financial_rule',
  [DOMAIN_EVENTS.ARTIST_ONBOARDING_STARTED]: 'artist',
  [DOMAIN_EVENTS.DISTRIBUTION_SETUP_REQUESTED]: 'artist',
  [DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_REQUESTED]: 'artist',
  [DOMAIN_EVENTS.CONTRACT_INTEGRATION_READY]: 'contract',
  [DOMAIN_EVENTS.ASSET_UPLOADED]: 'upload',
  [DOMAIN_EVENTS.TAKEDOWN_REQUESTED]: 'takedown',
};

@Injectable()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);
  private readonly notifRepo: Repository<NotificationEntity> | null = null;

  constructor(
    @Optional() private readonly wsGateway: RealtimeService,
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) this.notifRepo = ds.getRepository(NotificationEntity);
  }

  @OnEvent('artist.*')
  @OnEvent('contract.*')
  @OnEvent('release.*')
  @OnEvent('campaign.*')
  @OnEvent('lead.converted')
  @OnEvent('ticket.resolved')
  @OnEvent('workflow.transitioned')
  @OnEvent('transaction.created')
  @OnEvent('asset.uploaded')
  @OnEvent('distribution.setup_requested')
  @OnEvent('external-data.sync_requested')
  @OnEvent('takedown.requested')
  @OnEvent('tenant.created')
  @OnEvent('user.invited')
  @OnEvent('financial_rule.triggered')
  async onDomainNotificationEvent(event: DomainEvent<unknown>): Promise<void> {
    await this.handle(event);
  }

  private async handle<T>(event: DomainEvent<T>): Promise<void> {
    if (!event.tenantId) {
      this.logger.warn(
        `NotificationHandler: event "${event.type}" sem tenantId - abortado (fail-closed)`,
      );
      return;
    }

    const corrId = event.correlationId ?? CorrelationContext.get();
    const payload = event.payload as Record<string, unknown>;
    const labelFn = EVENT_LABELS[event.type];
    const title = labelFn ? labelFn(payload) : event.type;

    if (this.notifRepo && event.userId) {
      try {
        await this.runInTenantContext(event.tenantId, async (manager) => {
          const notifRepo = manager ? manager.getRepository(NotificationEntity) : this.notifRepo;
          if (!notifRepo) return;

          const notification = notifRepo.create({
            id: randomUUID(),
            tenant_id: event.tenantId,
            user_id: event.userId,
            title,
            body: null,
            type: event.type,
            entity: event.aggregateType ?? EVENT_AGGREGATE[event.type] ?? null,
            entity_id: event.aggregateId ?? null,
            read_at: null,
            metadata: {
              correlationId: corrId ?? null,
              occurredAt: event.occurredAt,
            },
          });
          await notifRepo.save(notification);
        });
      } catch (err) {
        this.logger.error(
          `NotificationHandler: failed to persist notification for "${event.type}" user=${event.userId} - ${String(err)}`,
        );
      }
    }

    if (!this.wsGateway) return;
    try {
      this.wsGateway.sendToTenant(event.tenantId, 'notification', {
        id: randomUUID(),
        type: event.type,
        title,
        tenantId: event.tenantId,
        userId: event.userId ?? null,
        correlationId: corrId ?? null,
        aggregateType: event.aggregateType ?? EVENT_AGGREGATE[event.type] ?? null,
        aggregateId: event.aggregateId ?? null,
        occurredAt: event.occurredAt,
        payload,
      });
    } catch (err) {
      this.logger.error(
        `NotificationHandler: WS broadcast failed for "${event.type}" - ${String(err)}`,
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
