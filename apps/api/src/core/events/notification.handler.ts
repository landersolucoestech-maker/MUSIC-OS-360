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
import { TRANSACTION_TYPE_LABELS_PT_BR, statusLabelPtBr } from '@music-os-360/types';
import { formatBrlPtBr, formatDatePtBr } from '../i18n/copy-format.pt-br';

/** ' para <PT-BR label>' when the status is a known canonical value; '' otherwise (never the raw value). */
function toStatusSuffix(domain: string, status: unknown): string {
  const label = statusLabelPtBr(domain, status);
  return label ? ` para ${label}` : '';
}

/** PT-BR noun phrase of a workflow entity type (the raw type never reaches the title). */
const WORKFLOW_ENTITY_PT_BR: Readonly<Record<string, string>> = {
  artist: 'do artista',
  contract: 'do contrato',
  release: 'do lançamento',
  work: 'da obra',
  phonogram: 'do fonograma',
  campaign: 'da campanha',
  project: 'do projeto',
  invoice: 'da nota fiscal',
  transaction: 'da transação',
};

/** ": R$ 1.500,00", or "" when the payload carries no numeric amount. */
function amountSuffix(value: unknown): string {
  const amount = formatBrlPtBr(value);
  return amount ? `: ${amount}` : '';
}

export function financialRuleLabel(p: Record<string, unknown>): string {
  const name = String(p['ruleName'] ?? '');
  const computed = (p['result'] as Record<string, unknown> | undefined)?.['computed'];
  const brl = typeof computed === 'number' ? formatBrlPtBr(computed) : null;
  if (!brl) return `Regra financeira disparada: ${name}`;
  return `Regra financeira disparada: ${name} — valor calculado ${brl} (nenhum lançamento foi criado)`;
}

export const EVENT_LABELS: Record<string, (p: Record<string, unknown>) => string> = {
  [DOMAIN_EVENTS.ARTIST_CREATED]: (p) => `Artista criado: ${p['nomeArtistico'] ?? ''}`,
  [DOMAIN_EVENTS.ARTIST_UPDATED]: (p) => `Artista atualizado: ${p['nomeArtistico'] ?? ''}`,
  [DOMAIN_EVENTS.ARTIST_STATUS_CHANGED]: (p) => `Status do artista ${p['nomeArtistico'] ?? ''} atualizado${toStatusSuffix('artist', p['newStatus'])}`,
  [DOMAIN_EVENTS.ARTIST_DELETED]: (p) => `Artista removido: ${p['nomeArtistico'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_CREATED]: (p) => `Contrato criado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_STATUS_CHANGED]: (p) => `Status do contrato ${p['title'] ?? ''} atualizado${toStatusSuffix('contract', p['newStatus'])}`,
  [DOMAIN_EVENTS.CONTRACT_SENT_FOR_SIGNATURE]: (p) => `Contrato enviado para assinatura: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_CANCELLED]: (p) => `Contrato cancelado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_EXPIRING_SOON]: (p) => `Contrato vencendo em ${p['daysLeft'] ?? '?'} dias: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_SIGNED]: (p) => `Contrato assinado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CONTRACT_EXPIRED]: (p) => `Contrato vencido: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.RELEASE_CREATED]: (p) => `Lançamento criado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.RELEASE_PUBLISHED]: (p) => `Lançamento publicado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.RELEASE_APPROVED]: (p) => `Lançamento aprovado: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.RELEASE_DISTRIBUTED]: (p) => `Lançamento distribuído: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CAMPAIGN_CREATED]: (p) => `Campanha criada: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CAMPAIGN_STARTED]: (p) => `Campanha iniciada: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.CAMPAIGN_ENDED]: (p) => `Campanha encerrada: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.LEAD_CONVERTED]: (p) => `Lead convertido: ${p['nome'] ?? ''}`,
  [DOMAIN_EVENTS.TICKET_RESOLVED]: (p) => `Ticket resolvido: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.WORKFLOW_TRANSITIONED]: (p) => {
    const domain = String(p['entityType'] ?? '');
    return `Status ${WORKFLOW_ENTITY_PT_BR[domain] ?? 'do registro'} atualizado${toStatusSuffix(domain, p['toStatus'])}`;
  },
  [DOMAIN_EVENTS.TRANSACTION_CREATED]: (p) =>
    `${TRANSACTION_TYPE_LABELS_PT_BR[p['type'] as keyof typeof TRANSACTION_TYPE_LABELS_PT_BR] ?? 'Transação'} registrada${amountSuffix(p['valor'])}`,
  [DOMAIN_EVENTS.TRANSACTION_STATUS_CHANGED]: (p) => `Status da transação atualizado${toStatusSuffix('transaction', p['newStatus'])}`,
  [DOMAIN_EVENTS.TRANSACTION_PAID]: (p) => `Pagamento baixado${amountSuffix(p['valor'])}`,
  [DOMAIN_EVENTS.TRANSACTION_CANCELLED]: (p) => `Transação cancelada${amountSuffix(p['valor'])}`,
  [DOMAIN_EVENTS.INVOICE_CREATED]: (p) => (p['numero'] ? `Nota fiscal criada: ${p['numero']}` : 'Nota fiscal criada'),
  [DOMAIN_EVENTS.INVOICE_STATUS_CHANGED]: (p) => `Status da nota fiscal${p['numero'] ? ` ${p['numero']}` : ''} atualizado${toStatusSuffix('invoice', p['newStatus'])}`,
  [DOMAIN_EVENTS.INVOICE_ISSUED]: (p) => (p['numero'] ? `Nota fiscal emitida: ${p['numero']}` : 'Nota fiscal emitida'),
  [DOMAIN_EVENTS.INVOICE_OVERDUE]: (p) => {
    const due = formatDatePtBr(p['dataVencimento']);
    return `Nota fiscal vencida${p['numero'] ? `: ${p['numero']}` : ''}${due ? ` (vencimento em ${due})` : ''}`;
  },
  // find-9e7bc94e: triggering a financial rule does NOT create a ledger entry —
  // its only effect is this notification, which must at least carry the amount
  // the rule computed (it used to be discarded).
  [DOMAIN_EVENTS.FINANCIAL_RULE_TRIGGERED]: (p) => financialRuleLabel(p),
  [DOMAIN_EVENTS.ARTIST_ONBOARDING_STARTED]: (p) => `Onboarding iniciado: ${p['nomeArtistico'] ?? ''}`,
  [DOMAIN_EVENTS.DISTRIBUTION_SETUP_REQUESTED]: () => 'Setup de distribuição solicitado',
  [DOMAIN_EVENTS.EXTERNAL_DATA_SYNC_REQUESTED]: () => 'Troca de dados externa solicitada',
  [DOMAIN_EVENTS.CONTRACT_INTEGRATION_READY]: (p) => `Contrato pronto para integração: ${p['title'] ?? ''}`,
  [DOMAIN_EVENTS.ASSET_UPLOADED]: (p) => `Arquivo enviado: ${p['fileName'] ?? ''}`,
  [DOMAIN_EVENTS.TENANT_CREATED]: (p) => `Conta criada: ${p['name'] ?? ''}`,
  [DOMAIN_EVENTS.USER_INVITED]: (p) => `Usuário convidado: ${p['email'] ?? ''}`,
  [DOMAIN_EVENTS.TAKEDOWN_REQUESTED]: () => 'Takedown solicitado',
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
        `NotificationHandler: event "${event.type}" without tenantId - aborted (fail-closed)`,
      );
      return;
    }

    const corrId = event.correlationId ?? CorrelationContext.get();
    const payload = event.payload as Record<string, unknown>;
    const labelFn = EVENT_LABELS[event.type];
    if (!labelFn) {
      // Unlabeled events must never surface their technical type as a title.
      this.logger.warn(`NotificationHandler: no PT-BR title for event "${event.type}" - using the generic title`);
    }
    const title = labelFn ? labelFn(payload) : 'Nova atividade registrada';

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
