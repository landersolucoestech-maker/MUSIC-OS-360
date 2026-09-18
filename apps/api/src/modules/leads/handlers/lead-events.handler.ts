import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ArtistStatus, ArtistStatusCadastro, LeadStatus } from '@music-os-360/types';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import {
  ArtistEntity,
  ClientEntity,
  LeadEntity,
} from '../../../database/entities';
import { DOMAIN_EVENTS, EventsService } from '../../../core/events/events.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type { LeadConvertedPayload } from '../../../core/events/domain-events.types';

@Injectable()
export class LeadEventsHandler {
  private readonly logger = new Logger(LeadEventsHandler.name);
  private readonly clientRepo: Repository<ClientEntity> | null = null;
  private readonly leadRepo: Repository<LeadEntity> | null = null;
  private readonly artistRepo: Repository<ArtistEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly events?: EventsService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) {
      this.clientRepo = ds.getRepository(ClientEntity);
      this.leadRepo = ds.getRepository(LeadEntity);
      this.artistRepo = ds.getRepository(ArtistEntity);
    }
  }

  @OnEvent(DOMAIN_EVENTS.LEAD_CONVERTED)
  async onLeadConverted(event: DomainEvent<LeadConvertedPayload>): Promise<void> {
    const tenantId = event.tenantId ?? event.payload.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { leadId, nome, empresa, convertedBy, convertedAt } = event.payload;

    if (this.clientRepo || this.leadRepo || this.artistRepo) {
      const created = await this.runInTenantContext(tenantId, async (manager) => {
        // find-aca0fb58: the idempotency read (find-22ec2dfa) and the
        // subsequent creates/update were not wrapped in any lock/transaction
        // spanning the whole sequence — two genuinely concurrent
        // LEAD_CONVERTED deliveries for the same lead could both observe
        // client_id=NULL before either commits, each creating its own
        // client+artist pair. A transaction-scoped advisory lock keyed by
        // leadId serializes the read-check-write sequence per lead. Runs as
        // a savepoint when `manager` already holds an open transaction
        // (session-context ON), or opens a real one otherwise.
        const base = manager ?? this.leadRepo!.manager;
        return base.transaction(async (txManager) => {
          await txManager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`lead-conversion:${tenantId}:${leadId}`]);
          return this.convertLead(txManager, tenantId, event, leadId, nome, empresa, convertedBy, convertedAt);
        });
      });

      // Emitido SÓ APÓS o commit da transação (fora do bloco acima) — o
      // listener de automação faz sua própria leitura via conexão separada;
      // emitir dentro da transação arriscaria uma leitura-suja da linha
      // clients ainda não commitada (race entre commit e o listener).
      if (created) {
        this.events?.emitTyped(DOMAIN_EVENTS.CLIENT_CREATED, {
          tenantId,
          userId: event.userId ?? convertedBy,
          aggregateType: 'client',
          aggregateId: created.clientId,
          payload: {
            clientId: created.clientId,
            tenantId,
            nome: created.nome,
            categoria: created.categoria,
            tipoPessoa: created.tipoPessoa,
            sourceLeadId: leadId,
            createdBy: event.userId ?? convertedBy,
          },
        });
      }
    }
  }

  private async convertLead(
    manager: EntityManager,
    tenantId: string,
    event: DomainEvent<LeadConvertedPayload>,
    leadId: string,
    nome: string,
    empresa: string | null,
    convertedBy: string,
    convertedAt: string,
  ): Promise<{ clientId: string; nome: string; categoria: string; tipoPessoa: string } | null> {
    let clientId: string | null = null;
    let createdCategoria = '';
    let createdTipoPessoa = '';
    const clientRepo = manager.getRepository(ClientEntity);
    const leadRepo = manager.getRepository(LeadEntity);
    const artistRepo = manager.getRepository(ArtistEntity);

    // find-22ec2dfa: leads.workflow.ts legitimately allows
    // CLOSED -> INACTIVE (archive) -> NEW (reactivate) -> re-progress to
    // CLOSED, which re-fires LEAD_CONVERTED for a lead that was already
    // converted once. Without this guard a second client+artist pair
    // would be created for the same lead on every re-conversion. Now runs
    // under the advisory lock above, so no concurrent delivery can race past
    // this check before this one's writes commit.
    {
      const existingLead = await leadRepo.findOne({ where: { id: leadId, tenant_id: tenantId } as never });
      if (existingLead?.client_id) {
        this.logger.warn(
          `LeadEventsHandler: lead "${leadId}" já convertido (client_id="${existingLead.client_id}") — LEAD_CONVERTED ignorado (idempotência)`,
        );
        return null;
      }
    }

    {
          try {
            createdCategoria = 'CORPORATE_CLIENT';
            createdTipoPessoa = empresa ? 'pessoa_juridica' : 'pessoa_fisica';
            const client = clientRepo.create({
              id: randomUUID(),
              tenant_id: tenantId,
              nome,
              categoria: createdCategoria,
              perfil: 'outros',
              tipo_pessoa: createdTipoPessoa,
              responsavel_nome: convertedBy,
              observacoes: `Convertido de lead ${leadId} em ${convertedAt}`,
              metadata: {
                leadId,
                convertedAt,
                convertedBy,
                correlationId: event.correlationId ?? null,
              },
              created_by: event.userId ?? convertedBy,
            });
            const saved = await clientRepo.save(client);
            clientId = saved.id;
            this.logger.log(
              `LeadEventsHandler: client "${clientId}" created from lead "${leadId}" (${nome}) tenant=${tenantId}`,
            );
          } catch (err) {
            this.logger.error(
              `LeadEventsHandler: failed to create client from lead "${leadId}" - ${String(err)}`,
            );
          }
        }

        if (leadRepo && clientId) {
          try {
            await leadRepo.update(
              { id: leadId, tenant_id: tenantId },
              { client_id: clientId, status: LeadStatus.CLOSED },
            );
            this.logger.log(
              `LeadEventsHandler: lead "${leadId}" -> status=${LeadStatus.CLOSED}, client_id="${clientId}"`,
            );
          } catch (err) {
            this.logger.error(
              `LeadEventsHandler: failed to update lead "${leadId}" with client link - ${String(err)}`,
            );
          }
        }

        if (artistRepo) {
          try {
            const artistId = randomUUID();
            const artist = artistRepo.create({
              id: artistId,
              tenant_id: tenantId,
              nome_artistico: nome,
              nome_civil: null,
              status: ArtistStatus.IN_NEGOTIATION,
              status_cadastro: ArtistStatusCadastro.ACTIVE,
              observacoes: `Criado automaticamente a partir da conversão do lead "${leadId}" em ${convertedAt}`,
              metadata: {
                leadId,
                clientId,
                convertedAt,
                convertedBy,
                correlationId: event.correlationId ?? null,
                source: 'lead_conversion',
              },
              created_by: event.userId ?? convertedBy,
            });
            await artistRepo.save(artist);
            this.logger.log(
              `LeadEventsHandler: artist onboarding stub "${artistId}" created for lead "${leadId}" (${nome})`,
            );
          } catch (err) {
            this.logger.error(
              `LeadEventsHandler: failed to create artist onboarding for lead "${leadId}" - ${String(err)}`,
            );
          }
        }

        return clientId ? { clientId, nome, categoria: createdCategoria, tipoPessoa: createdTipoPessoa } : null;
  }

  private failClosed(eventType: string): void {
    this.logger.warn(`LeadEventsHandler: event "${eventType}" sem tenantId - abortado (fail-closed)`);
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
