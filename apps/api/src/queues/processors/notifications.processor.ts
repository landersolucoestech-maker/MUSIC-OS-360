/**
 * queues/processors/notifications.processor.ts
 *
 * Processor BullMQ para a fila "notifications".
 * Persiste a notificação no banco (tabela notifications)
 * e emite via WebSocket para o utilizador em tempo real.
 */

import { Processor, WorkerHost }      from '@nestjs/bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job }                        from 'bullmq';
import { DataSource, Repository }     from 'typeorm';
import { QUEUE_NAMES, NOTIFICATION_JOB_NAMES } from '../queue.constants';
import { DATA_SOURCE }                from '../../database/database.module';
import { DatabaseContextService }     from '../../database/database-context.service';
import { NotificationEntity }         from '../../database/entities';
import { RealtimeService }            from '../../core/realtime/realtime.service';

export interface NotificationPayload {
  tenantId:  string;
  userId?:   string;
  title:     string;
  body?:     string;
  /** Notification type — generic (info/warning) or domain event identifier (contract:expiring) */
  type:      string;
  entity?:   string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.NOTIFICATIONS)
@Injectable()
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private readonly repo: Repository<NotificationEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    private readonly wsGateway: RealtimeService,
    private readonly dbContext: DatabaseContextService,
  ) {
    super();
    if (ds) this.repo = ds.getRepository(NotificationEntity);
  }

  async process(job: Job<NotificationPayload>): Promise<unknown> {
    this.logger.log(`[notifications] job="${job.name}" id=${job.id} tenant=${job.data.tenantId}`);

    switch (job.name) {
      case NOTIFICATION_JOB_NAMES.SEND:            return this.handleSend(job);
      case NOTIFICATION_JOB_NAMES.BROADCAST_TENANT: return this.handleBroadcast(job);
      default:
        this.logger.warn(`[notifications] job desconhecido: "${job.name}" — ignorado`);
        return null;
    }
  }

  private async handleSend(job: Job<NotificationPayload>): Promise<unknown> {
    const d = job.data;
    if (!this.repo) { this.logger.warn('[notifications/send] DB não configurado — pulando persistência'); return null; }
    // Fail-closed: an async job without a tenant must NOT touch tenant-scoped data.
    if (!d.tenantId) { this.logger.warn(`[notifications/send] job ${job.id} sem tenantId — abortado (fail-closed)`); return null; }

    // find-8dfe93c3 / find-32bf2e0a: BullMQ's at-least-once delivery can
    // redeliver the SAME job.id (a worker crash/stall after processing but
    // before ack, or a stalled-job lock-TTL expiry while a worker is still
    // finishing — a documented at-least-once scenario, not hypothetical).
    // bullmq_job_id is stored in `metadata` (no schema migration for a
    // low-volume table) and a partial UNIQUE index on it (migration
    // 20260912000001) makes dedup atomic in the DB regardless of worker
    // interleaving.
    //
    // find-855bcd84: an earlier version of this fix relied on catching a
    // 23505 unique-violation from repo.save() and re-querying inside the SAME
    // transaction — but with DATABASE_SESSION_CONTEXT_ENABLED=true (the
    // runInTenantContext manager IS a live transaction), Postgres aborts the
    // whole transaction after any statement error, so the re-query itself
    // fails with 25P02 ("current transaction is aborted"). INSERT ... ON
    // CONFLICT DO NOTHING never raises an error on the losing side — no
    // statement fails, so there is nothing to abort the transaction — making
    // this correct under both the transactional (flag ON) and passthrough
    // (flag OFF) paths.
    const jobId = job.id;
    let alreadyExisted = false;
    const saved = await this.dbContext.runInTenantContext(
      { tenantId: d.tenantId, orgId: null, role: null },
      async (manager) => {
        const repo = manager ? manager.getRepository(NotificationEntity) : this.repo!;
        const values = {
          tenant_id: d.tenantId,
          user_id:   d.userId ?? '',
          title:     d.title,
          body:      d.body     ?? null,
          type:      d.type,
          entity:    d.entity   ?? null,
          entity_id: d.entityId ?? null,
          metadata:  { ...(d.metadata ?? {}), ...(jobId ? { bullmq_job_id: jobId } : {}) },
        };

        const insert = await repo
          .createQueryBuilder()
          .insert()
          .into(NotificationEntity)
          .values(values as never)
          .onConflict(
            `("tenant_id", ((metadata ->> 'bullmq_job_id'))) WHERE (metadata ->> 'bullmq_job_id') IS NOT NULL DO NOTHING`,
          )
          .returning('*')
          .execute();

        if (insert.raw?.[0]) return insert.raw[0] as NotificationEntity;

        // Conflict: another worker already won the race for this job.id.
        const existing = await repo
          .createQueryBuilder('n')
          .where('n.tenant_id = :tenantId', { tenantId: d.tenantId })
          .andWhere("n.metadata->>'bullmq_job_id' = :jobId", { jobId })
          .getOne();
        alreadyExisted = true;
        return existing as NotificationEntity;
      },
    );

    if (alreadyExisted) {
      this.logger.log(`[notifications/send] job=${jobId} já processado (redelivery) — persistência/WS pulados, id=${saved.id}`);
      return saved;
    }

    this.logger.log(`[notifications/send] persistida id=${saved.id}`);

    try {
      if (d.userId) {
        this.wsGateway.sendToUser(d.tenantId, d.userId, 'notification:new', {
          id: saved.id, title: d.title, body: d.body, type: d.type, entity: d.entity, entityId: d.entityId, createdAt: saved.created_at,
        });
      } else {
        this.wsGateway.sendToTenant(d.tenantId, 'notification:new', {
          id: saved.id, title: d.title, body: d.body, type: d.type, entity: d.entity, entityId: d.entityId, createdAt: saved.created_at,
        });
      }
    } catch (wsErr) {
      this.logger.warn(`[notifications/send] WS emit falhou: ${(wsErr as Error).message}`);
    }

    return saved;
  }

  private handleBroadcast(job: Job<NotificationPayload>): { broadcasted: boolean } {
    const d = job.data;
    try {
      this.wsGateway.sendToTenant(d.tenantId, 'notification:new', {
        id: null, title: d.title, body: d.body, type: d.type, entity: d.entity, entityId: d.entityId, createdAt: new Date(),
      });
      this.logger.log(`[notifications/broadcast] tenant=${d.tenantId} — "${d.title}"`);
    } catch (wsErr) {
      this.logger.warn(`[notifications/broadcast] WS emit falhou: ${(wsErr as Error).message}`);
    }
    return { broadcasted: true };
  }
}
