import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { statusLabelPtBr } from '@music-os-360/types';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { ArtistGoalEntity } from '../../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../../core/events/events.service';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type {
  ArtistCreatedPayload,
  ArtistDeletedPayload,
  ArtistStatusChangedPayload,
  ArtistUpdatedPayload,
} from '../../../core/events/domain-events.types';

const INITIAL_GOALS = [
  { title: 'Meta de Streams Mensais', type: 'streams', target_value: '10000', period: 'monthly' },
  { title: 'Meta de Seguidores', type: 'followers', target_value: '5000', period: 'monthly' },
  { title: 'Meta de Receita Mensal (R$)', type: 'revenue', target_value: '3000', period: 'monthly' },
] as const;

@Injectable()
export class ArtistEventsHandler {
  private readonly logger = new Logger(ArtistEventsHandler.name);
  private readonly goalRepo: Repository<ArtistGoalEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly activityLogs: ActivityLogsService,
    @Optional() private readonly events: EventsService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) this.goalRepo = ds.getRepository(ArtistGoalEntity);
  }

  @OnEvent(DOMAIN_EVENTS.ARTIST_CREATED)
  async onArtistCreated(event: DomainEvent<ArtistCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId ?? event.payload.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { artistId, stageName } = event.payload;

    if (this.goalRepo) {
      try {
        await this.runInTenantContext(tenantId, async (manager) => {
          const goalRepo = manager ? manager.getRepository(ArtistGoalEntity) : this.goalRepo;
          if (!goalRepo) return;
          const goals = INITIAL_GOALS.map((goal) =>
            goalRepo.create({
              id: randomUUID(),
              tenant_id: tenantId,
              artist_id: artistId,
              title: goal.title,
              type: goal.type,
              target_value: goal.target_value,
              current_value: '0',
              period: goal.period,
              start_date: new Date(),
              end_date: null,
              metadata: { bootstrapped: true, correlationId: event.correlationId ?? null },
              created_by: event.userId ?? null,
            }),
          );
          await goalRepo.save(goals);
          this.logger.log(
            `Bootstrapped ${goals.length} goals for artist "${artistId}" (${stageName}) tenant=${tenantId}`,
          );
        });
      } catch (err) {
        this.logger.error(`Failed to bootstrap goals for "${artistId}" - ${String(err)}`);
      }
    }

    if (this.activityLogs && event.userId) {
      try {
        await this.runInTenantContext(tenantId, async () => {
          await this.activityLogs!.create(tenantId, event.userId!, {
            entity_type: 'artist',
            entity_id: artistId,
            action: 'created',
            description: `Artista "${stageName}" criado`,
            metadata: {
              stageName,
              status: event.payload.status,
              correlationId: event.correlationId ?? null,
            },
          });
        });
      } catch (err) {
        this.logger.warn(`Failed to write activity log for artist created "${artistId}" - ${String(err)}`);
      }
    }
  }

  @OnEvent(DOMAIN_EVENTS.ARTIST_STATUS_CHANGED)
  async onArtistStatusChanged(event: DomainEvent<ArtistStatusChangedPayload>): Promise<void> {
    const tenantId = event.tenantId ?? event.payload.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { artistId, stageName, previousStatus, newStatus, changedBy } = event.payload;
    this.logger.log(
      `Artist status changed: "${stageName}" (${artistId}) ${previousStatus} -> ${newStatus} by ${changedBy} tenant=${tenantId}`,
    );

    if (this.activityLogs && changedBy) {
      try {
        await this.runInTenantContext(tenantId, async () => {
          await this.activityLogs!.create(tenantId, changedBy, {
            entity_type: 'artist',
            entity_id: artistId,
            action: 'status_changed',
            description: `Status do artista "${stageName}" alterado de ${statusLabelPtBr('artist', previousStatus) ?? 'não informado'} para ${statusLabelPtBr('artist', newStatus) ?? 'não informado'}`,
            metadata: {
              stageName,
              previousStatus,
              newStatus,
              correlationId: event.correlationId ?? null,
            },
          });
        });
      } catch (err) {
        this.logger.warn(`Failed to write activity log for artist status change "${artistId}" - ${String(err)}`);
      }
    }

    if (!this.events) return;
    try {
      this.events.emitTyped(DOMAIN_EVENTS.WORKFLOW_TRANSITIONED, {
        tenantId,
        userId: changedBy,
        aggregateType: 'artist',
        aggregateId: artistId,
        payload: {
          entityType: 'artist',
          entityId: artistId,
          tenantId,
          fromStatus: previousStatus,
          toStatus: newStatus,
          actorId: changedBy,
          actorRole: undefined,
          reason: null,
          transitionedAt: event.occurredAt,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to emit WORKFLOW_TRANSITIONED for artist "${artistId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.ARTIST_DELETED)
  async onArtistDeleted(event: DomainEvent<ArtistDeletedPayload>): Promise<void> {
    const tenantId = event.tenantId ?? event.payload.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { artistId, stageName, deletedBy } = event.payload;
    this.logger.log(`Artist soft-deleted: "${stageName}" (${artistId}) by ${deletedBy} tenant=${tenantId}`);

    if (!this.activityLogs || !deletedBy) return;
    try {
      await this.runInTenantContext(tenantId, async () => {
        await this.activityLogs!.create(tenantId, deletedBy, {
          entity_type: 'artist',
          entity_id: artistId,
          action: 'deleted',
          description: `Artista "${stageName}" removido (soft-delete)`,
          metadata: {
            stageName,
            deletedBy,
            correlationId: event.correlationId ?? null,
          },
        });
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log for artist deleted "${artistId}" - ${String(err)}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.ARTIST_UPDATED)
  async onArtistUpdated(event: DomainEvent<ArtistUpdatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return this.failClosed(event.type);
  }

  private failClosed(eventType: string): void {
    this.logger.warn(`ArtistEventsHandler: event "${eventType}" without tenantId - aborted (fail-closed)`);
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
