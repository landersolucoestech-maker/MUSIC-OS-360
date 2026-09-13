import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { ArtistEntity, ContractEntity, TransactionEntity } from '../../../database/entities';
import { ArtistStatus } from '@music-os-360/types';
import { EventsService, DOMAIN_EVENTS } from '../../../core/events/events.service';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import { FinancialRulesService } from '../../financial-rules/financial-rules.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type {
  ContractCancelledPayload,
  ContractCreatedPayload,
  ContractExpiredPayload,
  ContractExpiringSoonPayload,
  ContractSentForSignaturePayload,
  ContractSignedPayload,
  ContractStatusChangedPayload,
} from '../../../core/events/domain-events.types';

@Injectable()
export class ContractEventsHandler {
  private readonly logger = new Logger(ContractEventsHandler.name);
  private readonly artistRepo: Repository<ArtistEntity> | null = null;
  private readonly transactionRepo: Repository<TransactionEntity> | null = null;
  private readonly contractRepo: Repository<ContractEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly activityLogs: ActivityLogsService,
    @Optional() private readonly events: EventsService,
    @Optional() private readonly financialRules: FinancialRulesService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) {
      this.artistRepo = ds.getRepository(ArtistEntity);
      this.transactionRepo = ds.getRepository(TransactionEntity);
      this.contractRepo = ds.getRepository(ContractEntity);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_CREATED)
  async onContractCreated(event: DomainEvent<ContractCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { contractId, title, type, artistId, createdBy } = event.payload;
    this.logger.log(`Contract created: "${title}" (${contractId}) type=${type} artist=${artistId ?? 'none'}`);

    if (!this.activityLogs || !createdBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, createdBy, {
          entity_type: 'contract',
          entity_id: contractId,
          action: 'created',
          description: `Contrato "${title}" criado`,
          metadata: { title, type, artistId, correlationId: event.correlationId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for contract created "${contractId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_STATUS_CHANGED)
  async onContractStatusChanged(event: DomainEvent<ContractStatusChangedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { contractId, title, previousStatus, newStatus, changedBy } = event.payload;
    this.logger.log(`Contract status: "${title}" ${previousStatus} -> ${newStatus} by ${changedBy}`);

    if (!this.activityLogs || !changedBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, changedBy, {
          entity_type: 'contract',
          entity_id: contractId,
          action: 'status_changed',
          description: `Status do contrato "${title}": ${previousStatus} -> ${newStatus}`,
          metadata: { previousStatus, newStatus, correlationId: event.correlationId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for contract status change "${contractId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_SENT_FOR_SIGNATURE)
  async onContractSentForSignature(event: DomainEvent<ContractSentForSignaturePayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { contractId, title, autentiqueDocId, sentBy } = event.payload;
    this.logger.log(`Contract sent for signature: "${title}" (${contractId}) docId=${autentiqueDocId}`);

    if (!this.activityLogs || !sentBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, sentBy, {
          entity_type: 'contract',
          entity_id: contractId,
          action: 'sent_for_signature',
          description: `Contrato "${title}" enviado para assinatura Autentique (doc=${autentiqueDocId})`,
          metadata: { autentiqueDocId, correlationId: event.correlationId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for contract sent "${contractId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_SIGNED)
  async onContractSigned(event: DomainEvent<ContractSignedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { contractId, title, artistId, signedBy, signedAt } = event.payload;

    if (this.artistRepo || this.transactionRepo || this.contractRepo || this.financialRules) {
      await this.runInTenantContext(tenantId, async (manager) => {
        const artistRepo = manager ? manager.getRepository(ArtistEntity) : this.artistRepo;
        const transactionRepo = manager ? manager.getRepository(TransactionEntity) : this.transactionRepo;
        const contractRepo = manager ? manager.getRepository(ContractEntity) : this.contractRepo;

        if (artistRepo && artistId) {
          try {
            await artistRepo.update(
              { id: artistId, tenant_id: tenantId },
              { status: ArtistStatus.SIGNED, contrato_id: contractId, updated_by: signedBy } as any,
            );
            this.logger.log(`Artist "${artistId}" -> ${ArtistStatus.SIGNED} + contrato_id="${contractId}"`);
          } catch (err) {
            this.logger.error(`Failed to update artist status for "${artistId}" - ${String(err)}`);
          }
        }

        if (transactionRepo && contractRepo) {
          try {
            const contract = await contractRepo
              .createQueryBuilder('c')
              .where('c.id = :id AND c.tenant_id = :tenantId', { id: contractId, tenantId })
              .getOne();

            const contractValor = contract?.valor ? parseFloat(String(contract.valor)) : 0;
            if (contractValor > 0) {
              const provisional = transactionRepo.create({
                tenant_id: tenantId,
                type: 'receita' as any,
                categoria: 'contratos',
                descricao: `Receita prevista - contrato "${title}"`,
                valor: String(contractValor),
                data: new Date(),
                status: 'scheduled' as any,
                artist_id: artistId ?? null,
                contrato_id: contractId,
                created_by: signedBy,
                updated_by: signedBy,
                metadata: { source: 'contract.signed', contractId, title },
              } as any);
              const savedTx = await transactionRepo.save(provisional as unknown as TransactionEntity);
              this.logger.log(`Provisional transaction "${savedTx.id}" (R$${contractValor}) created for contract "${contractId}"`);

              if (this.events) {
                this.events.emitTyped(DOMAIN_EVENTS.TRANSACTION_CREATED, {
                  tenantId,
                  userId: signedBy,
                  aggregateType: 'transaction',
                  aggregateId: savedTx.id,
                  payload: {
                    transactionId: savedTx.id,
                    tenantId,
                    type: 'receita',
                    categoria: 'contratos',
                    valor: String(contractValor),
                    contratoId: contractId,
                    artistId: artistId ?? null,
                    createdBy: signedBy,
                    source: 'contract.signed',
                  },
                });
              }

              if (this.financialRules) {
                await this.financialRules.evaluateRules(tenantId, 'contract.signed', {
                  entityId: contractId,
                  entityType: 'contract',
                  valor: contractValor,
                  categoria: 'contratos',
                });
              }
            }
          } catch (err) {
            this.logger.warn(`Failed to create provisional transaction for contract "${contractId}" - ${String(err)}`);
          }
        }
      });
    }

    if (!this.activityLogs || !signedBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, signedBy, {
          entity_type: 'contract',
          entity_id: contractId,
          action: 'signed',
          description: `Contrato "${title}" assinado`,
          metadata: { signedAt, artistId: artistId ?? null, correlationId: event.correlationId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for contract signed "${contractId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_CANCELLED)
  async onContractCancelled(event: DomainEvent<ContractCancelledPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { contractId, title, artistId, cancelledBy, cancelledAt } = event.payload;
    this.logger.log(`Contract cancelled: "${title}" (${contractId}) by ${cancelledBy}`);

    if (!this.activityLogs || !cancelledBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, cancelledBy, {
          entity_type: 'contract',
          entity_id: contractId,
          action: 'cancelled',
          description: `Contrato "${title}" cancelado`,
          metadata: { cancelledAt, artistId: artistId ?? null, correlationId: event.correlationId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for contract cancelled "${contractId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_EXPIRING_SOON)
  async onContractExpiringSoon(event: DomainEvent<ContractExpiringSoonPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { contractId, title, artistId, endDate, daysLeft } = event.payload;
    this.logger.warn(`Contract expiring soon: "${title}" (${contractId}) in ${daysLeft} days (${endDate})`);

    if (!this.activityLogs) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, 'system', {
          entity_type: 'contract',
          entity_id: contractId,
          action: 'expiring_soon',
          description: `Contrato "${title}" vence em ${daysLeft} dias (${endDate})`,
          metadata: { endDate, daysLeft, artistId: artistId ?? null },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for contract expiry "${contractId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.CONTRACT_EXPIRED)
  async onContractExpired(event: DomainEvent<ContractExpiredPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);
  }

  private failClosed(eventType: string): void {
    this.logger.warn(`ContractEventsHandler: event "${eventType}" sem tenantId - abortado (fail-closed)`);
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
