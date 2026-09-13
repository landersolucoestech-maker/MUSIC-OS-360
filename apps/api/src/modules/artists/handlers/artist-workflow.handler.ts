import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { ArtistStatus } from '@music-os-360/types';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { ArtistEntity, CrmTaskEntity } from '../../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../../core/events/events.service';
import { WorkflowQueueService } from '../../../queues/services/workflow-queue.service';
import { NotificationsQueueService } from '../../../queues/services/notifications-queue.service';
import type { DomainEvent } from '../../../core/events/events.service';
import type { ArtistStatusChangedPayload } from '../../../core/events/domain-events.types';

const ONBOARDING_TASKS: ReadonlyArray<{
  title: string;
  description: string;
  priority: string;
  daysFromNow: number;
}> = [
  { title: 'Onboarding artistico', description: 'Apresentar plataforma e fluxos ao artista', priority: 'high', daysFromNow: 3 },
  { title: 'Coleta documental', description: 'Solicitar e validar documentos', priority: 'high', daysFromNow: 5 },
  { title: 'Setup de distribuicao digital', description: 'Configurar perfil nas distribuidoras e DSPs', priority: 'medium', daysFromNow: 10 },
  { title: 'Setup de marketing', description: 'Criar perfis e plano de conteudo inicial', priority: 'medium', daysFromNow: 10 },
  { title: 'Revisao de identidade visual', description: 'Alinhar brand guidelines e assets visuais', priority: 'low', daysFromNow: 15 },
  { title: 'Kickoff operacional', description: 'Reuniao de alinhamento com equipe interna', priority: 'high', daysFromNow: 7 },
];

@Injectable()
export class ArtistWorkflowHandler {
  private readonly logger = new Logger(ArtistWorkflowHandler.name);
  private readonly artistRepo: Repository<ArtistEntity> | null = null;
  private readonly taskRepo: Repository<CrmTaskEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly events: EventsService,
    @Optional() private readonly workflowQueue: WorkflowQueueService,
    @Optional() private readonly notificationsQueue: NotificationsQueueService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) {
      this.artistRepo = ds.getRepository(ArtistEntity);
      this.taskRepo = ds.getRepository(CrmTaskEntity);
    }
  }

  @OnEvent(DOMAIN_EVENTS.ARTIST_STATUS_CHANGED)
  async onArtistStatusChanged(event: DomainEvent<ArtistStatusChangedPayload>): Promise<void> {
    const tenantId = event.tenantId ?? event.payload.tenantId;
    if (!tenantId) return this.failClosed(event.type);

    const { artistId, nomeArtistico, newStatus, changedBy } = event.payload;
    if (newStatus !== ArtistStatus.SIGNED) return;

    const now = new Date();
    const taskTitles: string[] = [];
    let shouldContinue = true;

    if (this.taskRepo || this.artistRepo) {
      await this.runInTenantContext(tenantId, async (manager) => {
        const taskRepo = manager ? manager.getRepository(CrmTaskEntity) : this.taskRepo;
        const artistRepo = manager ? manager.getRepository(ArtistEntity) : this.artistRepo;

        if (taskRepo) {
          try {
            const existing = await taskRepo.findOne({
              where: { tenant_id: tenantId, type: `artist.onboarding:${artistId}` },
            });
            if (existing) {
              shouldContinue = false;
              return;
            }
          } catch (err) {
            this.logger.warn(`Idempotency check failed for artist "${artistId}" - ${String(err)}`);
            shouldContinue = false;
            return;
          }

          try {
            const tasks = ONBOARDING_TASKS.map((task) => {
              const due = new Date(now);
              due.setDate(due.getDate() + task.daysFromNow);
              return taskRepo.create({
                tenant_id: tenantId,
                title: task.title,
                description: task.description,
                status: 'pending',
                priority: task.priority,
                type: `artist.onboarding:${artistId}`,
                assigned_to: changedBy,
                due_date: due,
                created_by: changedBy,
              });
            });
            await taskRepo.save(tasks);
            taskTitles.push(...ONBOARDING_TASKS.map((task) => task.title));
          } catch (err) {
            this.logger.error(`Failed to create onboarding tasks for "${artistId}" - ${String(err)}`);
          }
        }

        if (artistRepo) {
          try {
            const artist = await artistRepo.findOne({ where: { id: artistId, tenant_id: tenantId } });
            if (artist) {
              await artistRepo.update(
                { id: artistId, tenant_id: tenantId },
                { metadata: { ...artist.metadata, onboarding_tasks_created_at: now.toISOString() } } as any,
              );
            }
          } catch (err) {
            this.logger.warn(`Failed to update artist metadata for "${artistId}" - ${String(err)}`);
          }
        }
      });
    }

    if (!shouldContinue) return;

    if (this.events) {
      try {
        this.events.emitTyped(DOMAIN_EVENTS.ARTIST_ONBOARDING_STARTED, {
          tenantId,
          userId: changedBy,
          aggregateType: 'artist',
          aggregateId: artistId,
          payload: { artistId, tenantId, nomeArtistico, tasks: taskTitles, startedAt: now.toISOString() },
        });
        this.events.emitTyped(DOMAIN_EVENTS.DISTRIBUTION_SETUP_REQUESTED, {
          tenantId,
          userId: changedBy,
          aggregateType: 'artist',
          aggregateId: artistId,
          payload: { artistId, tenantId, contractId: null, requestedAt: now.toISOString(), providerHint: null },
        });
      } catch (err) {
        this.logger.warn(`Failed to emit artist workflow events for "${artistId}" - ${String(err)}`);
      }
    }

    if (this.workflowQueue) {
      try {
        await Promise.all([
          this.workflowQueue.enqueueOnboardingCheck({
            tenantId,
            artistId,
            tasks: taskTitles,
            correlationId: event.correlationId ?? null,
          }),
          this.workflowQueue.enqueueDistributionSync({
            tenantId,
            artistId,
            contractId: null,
            providerHint: null,
            correlationId: event.correlationId ?? null,
          }),
        ]);
      } catch (err) {
        this.logger.warn(`Failed to enqueue workflow jobs for "${artistId}" - ${String(err)}`);
      }
    }

    if (this.notificationsQueue) {
      try {
        await this.notificationsQueue.enqueue({
          tenantId,
          userId: changedBy,
          title: `Onboarding iniciado: ${nomeArtistico}`,
          body: `Artista contratado - ${taskTitles.length} tarefas criadas`,
          type: 'artist:onboarding_started',
          entity: 'artist',
          entityId: artistId,
          metadata: { artistId, nomeArtistico, correlationId: event.correlationId ?? null },
        });
      } catch (err) {
        this.logger.warn(`Failed to enqueue onboarding notification for "${artistId}" - ${String(err)}`);
      }
    }
  }

  private failClosed(eventType: string): void {
    this.logger.warn(`ArtistWorkflowHandler: event "${eventType}" sem tenantId - abortado (fail-closed)`);
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
